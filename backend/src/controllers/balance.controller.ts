import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { tripBalances } from "../domain/money/index.js";
import { findExpenses } from "../models/expense.model.js";
import { listAllTripMembers } from "../models/member.model.js";
import { findSettlements } from "../models/settlement.model.js";
import type { MemberDoc } from "../schemas/models.js";
import { balancesView, summaryView, type BalanceData } from "../views/balance.view.js";

/**
 * Net Balance, Outstanding and Suggested Transfers, computed from the trip's Expenses and
 * Settlements on every call (never stored). Uses every Member, since old Expenses may name
 * removed ones.
 */
export async function loadBalances(tripId: string): Promise<BalanceData> {
  const [members, expenses, settlements] = await Promise.all([
    listAllTripMembers(tripId),
    findExpenses(tripId),
    findSettlements(tripId),
  ]);
  const computed = tripBalances(members.map((m) => m._id), expenses, settlements);
  return { members, expenses, settlements, ...computed };
}

/**
 * SPEC สิทธิ์ "ดูอย่างเดียว: ดูแผนและยอดของตัวเอง" — a viewer gets only their own row and only the
 * Suggested Transfers they are part of. Trip totals (`total`, `byCategory`) stay. owner/editor see all.
 */
function visibleTo(d: BalanceData, me: MemberDoc): BalanceData {
  if (me.role !== "viewer") return d;
  return {
    ...d,
    rows: d.rows.filter((r) => r.memberId === me._id),
    transfers: d.transfers.filter((t) => t.fromId === me._id || t.toId === me._id),
  };
}

/** A14 */
export const getBalances: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  res.json(balancesView(visibleTo(await loadBalances(me.tripId), me)));
};

/** Summary page: A14 + `byCategory` + per-Member `items` (ที่มา). */
export const getSummary: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  res.json(summaryView(visibleTo(await loadBalances(me.tripId), me)));
};
