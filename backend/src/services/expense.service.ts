import type { z } from "zod";
import { assertOwnerOrCreator } from "../auth/ownership.js";
import { newId } from "../db/ids.js";
import { formatBaht } from "../domain/format.js";
import { split, SplitError, type ShareInput } from "../domain/money/index.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { deleteExpense, findExpense, findExpenses, insertExpense, replaceExpense } from "../models/expense.model.js";
import { listTripMembers } from "../models/member.model.js";
import { unlinkExpenseFromPlaces } from "../models/place.model.js";
import { unlinkExpense } from "../models/plan.model.js";
import { documentsExist } from "../models/reference.model.js";
import type { ExpenseDoc, MemberDoc } from "../schemas/models.js";
import type { ExpenseCreateBody, ExpenseUpdateBody } from "../schemas/money.js";

const bad = (code: string, message: string) => new HttpError(400, code, message);
const expenseNotFound = () => new HttpError(404, "expense_not_found", "ไม่พบรายการนี้ อาจถูกลบไปแล้ว");
const label = (e: Pick<ExpenseDoc, "title" | "amount">) => `"${e.title}" ${formatBaht(e.amount)}`;

type ExpenseFields = Omit<z.infer<typeof ExpenseCreateBody>, "shares"> & { shares: ShareInput[] };

/**
 * Checks the rules zod cannot (400): payer and sharers are active Members of the trip (or already
 * on the Expense being edited, so a soft-removed Member does not lock old Expenses), the card
 * digits / card name only for card, the slip only for promptpay and from this trip; then resolves every
 * Share so they sum exactly to the amount.
 */
async function resolveFields(tripId: string, f: ExpenseFields, alreadyOn: string[] = []) {
  const memberIds = new Set((await listTripMembers(tripId)).filter((m) => m.status === "active").map((m) => m._id));
  for (const id of alreadyOn) memberIds.add(id);
  if (!memberIds.has(f.payerId) || f.shares.some((s) => !memberIds.has(s.memberId))) {
    throw bad("unknown_member", "คนจ่ายและคนที่ร่วมหารต้องเป็นสมาชิกของทริปนี้");
  }
  if (f.cardLast4 && f.method !== "card") throw bad("invalid_card", "ใส่เลขท้ายบัตรได้เฉพาะการจ่ายด้วยบัตร");
  if (f.cardName && f.method !== "card") throw bad("invalid_card", "ใส่ชื่อบัตรได้เฉพาะการจ่ายด้วยบัตร");
  if (f.slipDocId && f.method !== "promptpay") throw bad("invalid_slip", "แนบสลิปได้เฉพาะการโอน/พร้อมเพย์");
  if (f.slipDocId && !(await documentsExist(tripId, [f.slipDocId]))) throw bad("unknown_document", "ไม่พบสลิปในทริปนี้");
  try {
    return split({ mode: f.splitMode, total: f.amount, payerId: f.payerId, shares: f.shares });
  } catch (err) {
    if (err instanceof SplitError) throw bad("invalid_split", "ยอดที่แบ่งต้องรวมเท่ากับยอดค่าใช้จ่ายพอดี");
    throw err;
  }
}

/** Stored fields from validated input; optional fields are left out when absent. */
function toDoc(f: ExpenseFields, shares: ExpenseDoc["shares"]) {
  return {
    title: f.title,
    category: f.category,
    payerId: f.payerId,
    method: f.method,
    ...(f.cardLast4 ? { cardLast4: f.cardLast4 } : {}),
    ...(f.cardName ? { cardName: f.cardName } : {}),
    amount: f.amount,
    currency: "THB" as const,
    baseAmount: f.amount, // THB only for now
    splitMode: f.splitMode,
    shares,
    ...(f.slipDocId ? { slipDocId: f.slipDocId } : {}),
    ...(f.note ? { note: f.note } : {}),
    date: f.date,
  };
}

async function existingExpense(tripId: string, expenseId: string): Promise<ExpenseDoc> {
  const expense = await findExpense(tripId, expenseId);
  if (!expense) throw expenseNotFound();
  return expense;
}

/** A11 — every role sees all Expenses of the trip. */
export function list(tripId: string): Promise<ExpenseDoc[]> {
  return findExpenses(tripId);
}

/** A12 */
export function get(tripId: string, expenseId: string): Promise<ExpenseDoc> {
  return existingExpense(tripId, expenseId);
}

/** B29 — editor+. */
export async function create(me: MemberDoc, body: z.infer<typeof ExpenseCreateBody>): Promise<ExpenseDoc> {
  const shares = await resolveFields(me.tripId, body);
  const expense: ExpenseDoc = { _id: newId(), tripId: me.tripId, ...toDoc(body, shares), createdBy: me._id, createdAt: new Date() };
  await insertExpense(expense);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "expense", refId: expense._id, text: `เพิ่มค่าใช้จ่าย ${label(expense)}` });
  return expense;
}

/**
 * B30 — owner, or the editor who created it. Shares are re-resolved from the merged fields.
 * `parseBody` runs after the 404/403 checks, so those answer before a bad body.
 */
export async function patch(me: MemberDoc, expenseId: string, parseBody: () => z.infer<typeof ExpenseUpdateBody>): Promise<ExpenseDoc> {
  const existing = await existingExpense(me.tripId, expenseId);
  assertOwnerOrCreator(me, existing.createdBy, "คุณแก้หรือลบได้เฉพาะรายการที่ตัวเองเพิ่ม");
  const body = parseBody();

  const method = body.method ?? existing.method;
  const fields: ExpenseFields = {
    title: body.title ?? existing.title,
    category: body.category ?? existing.category,
    payerId: body.payerId ?? existing.payerId,
    method,
    // Changing the method away from card / promptpay drops the card digits / slip.
    cardLast4: body.cardLast4 === undefined ? (method === "card" ? existing.cardLast4 : undefined) : (body.cardLast4 ?? undefined),
    cardName: body.cardName === undefined ? (method === "card" ? existing.cardName : undefined) : (body.cardName ?? undefined),
    amount: body.amount ?? existing.amount,
    splitMode: body.splitMode ?? existing.splitMode,
    shares: body.shares ?? existing.shares,
    slipDocId: body.slipDocId === undefined ? (method === "promptpay" ? existing.slipDocId : undefined) : (body.slipDocId ?? undefined),
    note: body.note === undefined ? existing.note : (body.note ?? undefined),
    date: body.date ?? existing.date,
  };
  const shares = await resolveFields(me.tripId, fields, [existing.payerId, ...existing.shares.map((s) => s.memberId)]);
  const expense = await replaceExpense({
    _id: existing._id,
    tripId: existing.tripId,
    ...toDoc(fields, shares),
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedBy: me._id,
    updatedAt: new Date(),
  });
  if (!expense) throw expenseNotFound();
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "expense", refId: expense._id, text: `แก้ไขค่าใช้จ่าย ${label(expense)}` });
  return expense;
}

/** B31 — owner, or the editor who created it. Transit cards and stay Places linking it lose the link. */
export async function remove(me: MemberDoc, expenseId: string): Promise<void> {
  const existing = await existingExpense(me.tripId, expenseId);
  assertOwnerOrCreator(me, existing.createdBy, "คุณแก้หรือลบได้เฉพาะรายการที่ตัวเองเพิ่ม");
  if (!(await deleteExpense(me.tripId, existing._id))) throw expenseNotFound();
  await unlinkExpense(me.tripId, existing._id);
  await unlinkExpenseFromPlaces(me.tripId, existing._id);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "expense", refId: null, text: `ลบค่าใช้จ่าย ${label(existing)}` });
}
