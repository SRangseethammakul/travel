/**
 * Settlement status moves one way: pending (computed, never stored) → sent (the sender) →
 * confirmed (the receiver). Every step is one conditional update that filters on the current
 * status and on who may act (docs/db/schema.md §5.3).
 */
import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { isDuplicateKeyError, newId } from "../db/ids.js";
import { formatBaht } from "../domain/format.js";
import { reportableAmount } from "../domain/money/index.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { findActiveTripMember, findMemberAnyStatus } from "../models/member.model.js";
import { documentsExist } from "../models/reference.model.js";
import {
  deleteSentSettlement,
  findSettlement,
  findSettlements,
  insertSettlement,
  transitionSettlement,
} from "../models/settlement.model.js";
import { SettlementCreateBody, SlipBody } from "../schemas/money.js";
import type { SettlementDoc } from "../schemas/models.js";
import { settlementView } from "../views/settlement.view.js";
import { loadBalances } from "./balance.controller.js";
import { param } from "./params.js";

const notFound = () => new HttpError(404, "settlement_not_found", "ไม่พบรายการโอนนี้");

/** After a conditional update matched nothing: say why (404 missing · 403 not yours · 409 wrong status). */
async function whyNoMatch(tripId: string, id: string, isAllowed: (s: SettlementDoc) => boolean, message409: string): Promise<never> {
  const s = await findSettlement(tripId, id);
  if (!s) throw notFound();
  if (!isAllowed(s)) throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  throw new HttpError(409, "invalid_status", message409);
}

async function assertSlip(tripId: string, slipDocId: string | undefined): Promise<void> {
  if (slipDocId && !(await documentsExist(tripId, [slipDocId]))) {
    throw new HttpError(400, "unknown_document", "ไม่พบสลิปในทริปนี้");
  }
}

/** A13 — every role sees all Settlements of the trip. */
export const listSettlements: RequestHandler = async (req, res) => {
  res.json((await findSettlements(currentMember(req).tripId)).map(settlementView));
};

/**
 * B32 — any role, viewers included: the Current Member reports a transfer they made (`fromId` = me).
 * Without `amount` it uses the Suggested Transfer to `toId`, lowered to what I have not reported yet.
 * The amount plus my other `sent` reports may not exceed what I owe (Outstanding) → 400 (BUG-B6).
 * The receiver must be owed money → else 400. An Unclaimed receiver is allowed: they confirm after a Claim.
 */
export const reportSettlement: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const body = SettlementCreateBody.parse(req.body);
  if (body.toId === me._id) throw new HttpError(400, "invalid_receiver", "โอนให้ตัวเองไม่ได้");
  const to = await findActiveTripMember(me.tripId, body.toId);
  if (!to) throw new HttpError(400, "unknown_member", "ผู้รับต้องเป็นสมาชิกของทริปนี้");
  await assertSlip(me.tripId, body.slipDocId);

  const balances = await loadBalances(me.tripId);
  // One open Settlement per pair (decided 2026-11-12). Checked on the same snapshot as the limit, so an
  // open report to this receiver always answers 409; the unique index `settlements_open_pair` closes the race.
  const alreadySent = () => new HttpError(409, "already_sent", "แจ้งโอนไปแล้ว รอผู้รับยืนยัน");
  if (balances.settlements.some((s) => s.fromId === me._id && s.toId === to._id && s.status === "sent")) throw alreadySent();

  const outstanding = balances.rows.find((r) => r.memberId === me._id)?.outstanding ?? 0;
  const suggested = balances.transfers.find((t) => t.fromId === me._id && t.toId === to._id)?.amount;
  if (outstanding >= 0 || (body.amount === undefined && suggested === undefined)) {
    throw new HttpError(409, "nothing_owed", "ไม่มียอดที่คุณต้องโอนให้คนนี้แล้ว");
  }
  // The receiver must be owed money (Outstanding > 0); paying anyone else would not settle anything.
  const toOutstanding = balances.rows.find((r) => r.memberId === to._id)?.outstanding ?? 0;
  if (toOutstanding <= 0) throw new HttpError(400, "receiver_not_owed", `${to.displayName} ไม่มียอดที่ต้องได้คืน`);
  // BUG-B6: this report plus my other `sent` reports must not exceed what I owe.
  const tooLarge = (left: number) =>
    new HttpError(400, "amount_too_large", `ยอดโอนเกินยอดค้างที่ยังไม่ได้แจ้งโอน (${formatBaht(Math.max(0, left))})`);
  const left = reportableAmount(me._id, outstanding, balances.settlements);
  if (left <= 0) throw tooLarge(left);
  // Without `amount`: the Suggested Transfer, lowered to what I have not reported yet.
  const amount = body.amount ?? Math.min(suggested!, left);
  if (amount > left) throw tooLarge(left);

  const now = new Date();
  const settlement: SettlementDoc = {
    _id: newId(),
    tripId: me.tripId,
    fromId: me._id,
    toId: to._id,
    amount,
    status: "sent",
    ...(body.slipDocId ? { slipDocId: body.slipDocId } : {}),
    createdAt: now,
    sentAt: now,
  };
  try {
    await insertSettlement(settlement);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw alreadySent();
    throw err;
  }
  // Two reports to different receivers can both pass the check above. Re-check after inserting:
  // a request that sees the total over the limit takes its own report back. Both may back out; both
  // can never stay, because the later insert always sees the earlier one. (API.md B32)
  const after = await loadBalances(me.tripId);
  const outstandingAfter = after.rows.find((r) => r.memberId === me._id)?.outstanding ?? 0;
  if (reportableAmount(me._id, outstandingAfter, after.settlements) < 0) {
    await deleteSentSettlement(me.tripId, settlement._id);
    throw tooLarge(reportableAmount(me._id, outstandingAfter, after.settlements.filter((s) => s._id !== settlement._id)));
  }
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "settlement",
    refId: settlement._id,
    text: `แจ้งโอนเงินให้ ${to.displayName} ${formatBaht(amount)}${settlement.slipDocId ? " พร้อมแนบสลิป" : ""}`,
  });
  res.status(201).json(settlementView(settlement));
};

/** B33 — receiver only: sent → confirmed. */
export const confirmSettlement: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const id = param(req, "settlementId");
  const s = await transitionSettlement(
    { _id: id, tripId: me.tripId, toId: me._id, status: "sent" },
    { status: "confirmed", confirmedAt: new Date() },
  );
  if (!s) return whyNoMatch(me.tripId, id, (x) => x.toId === me._id, "ยืนยันได้เฉพาะรายการที่แจ้งโอนแล้วและยังไม่ยืนยัน");
  const from = await findMemberAnyStatus(me.tripId, s.fromId);
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "settlement",
    refId: s._id,
    text: `ยืนยันได้รับเงินจาก ${from?.displayName ?? "สมาชิก"} ${formatBaht(s.amount)}`,
  });
  res.json(settlementView(s));
};

/** B34 — sender only, while still sent: attach or replace the slip. */
export const replaceSlip: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const id = param(req, "settlementId");
  const { slipDocId } = SlipBody.parse(req.body);
  await assertSlip(me.tripId, slipDocId);
  const s = await transitionSettlement({ _id: id, tripId: me.tripId, fromId: me._id, status: "sent" }, { slipDocId });
  if (!s) return whyNoMatch(me.tripId, id, (x) => x.fromId === me._id, "แนบสลิปได้เฉพาะรายการที่ยังรอผู้รับยืนยัน");
  const to = await findMemberAnyStatus(me.tripId, s.toId);
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "settlement",
    refId: s._id,
    text: `แนบสลิปการโอนให้ ${to?.displayName ?? "ผู้รับ"} ${formatBaht(s.amount)}`,
  });
  res.json(settlementView(s));
};
