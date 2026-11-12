/** Suggested Transfers from Outstanding (positive = to receive), fewest transfers. Same rules as the frontend. */

export interface SuggestedTransfer {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * 1. Pair debtors and creditors with exactly matching amounts.
 * 2. Greedily settle the largest debtor against the largest creditor.
 * Each step clears at least one person, so at most n − 1 transfers. Ties keep input order.
 */
export function suggestTransfers(outstanding: Readonly<Record<string, number>>): SuggestedTransfer[] {
  const entries = Object.entries(outstanding);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  if (sum !== 0) throw new Error(`outstanding balances must sum to 0 (got ${sum})`);

  type Party = { id: string; left: number; order: number };
  const creditors: Party[] = [];
  const debtors: Party[] = [];
  entries.forEach(([id, v], order) => {
    if (!Number.isSafeInteger(v)) throw new TypeError(`balance for ${id} must be integer satang`);
    if (v > 0) creditors.push({ id, left: v, order });
    else if (v < 0) debtors.push({ id, left: -v, order });
  });

  const transfers: SuggestedTransfer[] = [];
  for (const d of debtors) {
    const match = creditors.find((c) => c.left > 0 && c.left === d.left);
    if (match) {
      transfers.push({ fromId: d.id, toId: match.id, amount: d.left });
      match.left = 0;
      d.left = 0;
    }
  }

  const byLargest = (a: Party, b: Party) => b.left - a.left || a.order - b.order;
  for (;;) {
    const d = debtors.filter((p) => p.left > 0).sort(byLargest)[0];
    const c = creditors.filter((p) => p.left > 0).sort(byLargest)[0];
    if (!d || !c) break;
    const amount = Math.min(d.left, c.left);
    transfers.push({ fromId: d.id, toId: c.id, amount });
    d.left -= amount;
    c.left -= amount;
  }
  return transfers;
}

/**
 * How much a Member may still report as sent (BUG-B6): what they owe after confirmed Settlements
 * (−Outstanding) minus their Settlements already reported as `sent`. Negative = already over-reported.
 */
export function reportableAmount(
  memberId: string,
  outstanding: number,
  settlements: readonly { fromId: string; amount: number; status: string }[],
): number {
  const sent = settlements.filter((s) => s.fromId === memberId && s.status === "sent").reduce((sum, s) => sum + s.amount, 0);
  return -outstanding - sent;
}
