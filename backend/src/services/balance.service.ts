import { tripBalances } from "../domain/money/index.js";
import { findExpenses } from "../models/expense.model.js";
import { listAllTripMembers } from "../models/member.model.js";
import { findSettlements } from "../models/settlement.model.js";
import type { MemberDoc } from "../schemas/models.js";
import type { BalanceData } from "../views/balance.view.js";

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

/** A14 / summary — the balances this Member may see. */
export async function loadVisibleBalances(me: MemberDoc): Promise<BalanceData> {
  return visibleTo(await loadBalances(me.tripId), me);
}
