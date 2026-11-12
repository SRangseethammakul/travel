/** Net Balance and Outstanding (CONTEXT.md). Computed on every request, never stored. */

export interface BalanceExpense {
  payerId: string;
  amount: number;
  shares: readonly { memberId: string; amount: number }[];
}

export interface BalanceSettlement {
  fromId: string;
  toId: string;
  amount: number;
  status: "pending" | "sent" | "confirmed";
}

export interface MemberBalance {
  memberId: string;
  paid: number;
  share: number;
  /** paid − share. Positive = owed money. Not affected by Settlements. */
  net: number;
}

export function netBalances(memberIds: readonly string[], expenses: readonly BalanceExpense[]): MemberBalance[] {
  const rows = new Map<string, MemberBalance>(memberIds.map((id) => [id, { memberId: id, paid: 0, share: 0, net: 0 }]));
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

/** Net Balance after confirmed Settlements only (`sent` does not count yet). */
export function outstandingBalances(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
  settlements: readonly BalanceSettlement[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of netBalances(memberIds, expenses)) result[b.memberId] = b.net;
  for (const s of settlements) {
    if (s.status !== "confirmed") continue;
    const from = result[s.fromId];
    const to = result[s.toId];
    if (from === undefined || to === undefined) throw new Error("settlement references unknown member");
    result[s.fromId] = from + s.amount;
    result[s.toId] = to - s.amount;
  }
  return result;
}

export function totalSpent(expenses: readonly { amount: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}
