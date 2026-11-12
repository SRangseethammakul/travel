import type { Satang } from "./format";

export interface BalanceExpense {
  payerId: string;
  amount: Satang;
  shares: readonly { memberId: string; amount: Satang }[];
}

export interface BalanceSettlement {
  fromId: string;
  toId: string;
  amount: Satang;
  status: "pending" | "sent" | "confirmed";
}

export interface MemberBalance {
  memberId: string;
  /** What the member paid for Expenses. */
  paid: Satang;
  /** Sum of the member's Shares. */
  share: Satang;
  /** paid − share. Positive = owed money. Not affected by Settlements. */
  net: Satang;
}

/** Net Balance per Member, computed from Expenses only (CONTEXT.md). */
export function netBalances(memberIds: readonly string[], expenses: readonly BalanceExpense[]): MemberBalance[] {
  const rows = new Map<string, MemberBalance>(
    memberIds.map((id) => [id, { memberId: id, paid: 0, share: 0, net: 0 }]),
  );
  const row = (id: string) => {
    const r = rows.get(id);
    if (!r) throw new Error(`unknown member ${id}`);
    return r;
  };
  for (const e of expenses) {
    row(e.payerId).paid += e.amount;
    for (const s of e.shares) row(s.memberId).share += s.amount;
  }
  for (const r of rows.values()) r.net = r.paid - r.share;
  return [...rows.values()];
}

/**
 * Outstanding per Member: Net Balance after confirmed Settlements.
 * A confirmed transfer from A to B moves A up and B down by the amount.
 * `pending` and `sent` Settlements do not count yet.
 */
export function outstandingBalances(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
  settlements: readonly BalanceSettlement[],
): Record<string, Satang> {
  const result: Record<string, Satang> = {};
  for (const b of netBalances(memberIds, expenses)) result[b.memberId] = b.net;
  for (const s of settlements) {
    if (s.status !== "confirmed") continue;
    if (!(s.fromId in result) || !(s.toId in result)) throw new Error("settlement references unknown member");
    result[s.fromId] += s.amount;
    result[s.toId] -= s.amount;
  }
  return result;
}

export function totalSpent(expenses: readonly { amount: Satang }[]): Satang {
  return expenses.reduce((s, e) => s + e.amount, 0);
}
