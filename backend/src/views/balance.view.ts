import type { TripBalanceRow } from "../domain/money/trip.js";
import type { SuggestedTransfer } from "../domain/money/settle.js";
import type { ExpenseDoc, MemberDoc, SettlementDoc } from "../schemas/models.js";
import { memberView } from "./member.view.js";
import { settlementView } from "./settlement.view.js";

const CATEGORIES: ExpenseDoc["category"][] = ["stay", "transport", "food", "activity", "other"];

export interface BalanceData {
  members: MemberDoc[];
  expenses: ExpenseDoc[];
  settlements: SettlementDoc[];
  total: number;
  rows: TripBalanceRow[];
  transfers: SuggestedTransfer[];
}

/** Members listed in the tables: active ones, plus anyone else who still has money on the trip. */
function shownRows(d: BalanceData) {
  const byId = new Map(d.members.map((m) => [m._id, m]));
  return d.rows
    .map((r) => ({ r, m: byId.get(r.memberId)! }))
    .filter(({ r, m }) => m.status === "active" || r.paid !== 0 || r.share !== 0 || r.outstanding !== 0);
}

/** A14 `TripBalances`: Net Balance and Outstanding per Member, Suggested Transfers with their open Settlement. */
export function balancesView(d: BalanceData) {
  const byId = new Map(d.members.map((m) => [m._id, m]));
  return {
    total: d.total,
    rows: shownRows(d).map(({ r, m }) => ({ member: memberView(m), paid: r.paid, share: r.share, net: r.net, outstanding: r.outstanding })),
    transfers: d.transfers.map((t) => {
      // Matched by pair, not amount: a partial transfer still belongs to this Suggested Transfer
      // (at most one open Settlement per pair — `settlements_open_pair`).
      const open = d.settlements.find((s) => s.fromId === t.fromId && s.toId === t.toId && s.status !== "confirmed");
      return {
        from: memberView(byId.get(t.fromId)!),
        to: memberView(byId.get(t.toId)!),
        amount: t.amount,
        settlement: open ? settlementView(open) : null,
      };
    }),
  };
}

/** Summary page: `TripBalances` + spending per category + where each Member's numbers come from. */
export function summaryView(d: BalanceData) {
  const base = balancesView(d);
  const byCategory = CATEGORIES.map((category) => ({
    category,
    amount: d.expenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0),
  })).filter((c) => c.amount > 0);
  const rows = base.rows.map((row) => ({
    ...row,
    items: d.expenses
      .map((e) => ({
        expenseId: e._id,
        title: e.title,
        date: e.date,
        paid: e.payerId === row.member.id ? e.amount : 0,
        share: e.shares.find((s) => s.memberId === row.member.id)?.amount ?? 0,
      }))
      .filter((i) => i.paid !== 0 || i.share !== 0),
  }));
  return { ...base, byCategory, rows };
}
