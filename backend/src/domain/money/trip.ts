import { netBalances, outstandingBalances, totalSpent, type BalanceExpense, type BalanceSettlement } from "./balance.js";
import { suggestTransfers, type SuggestedTransfer } from "./settle.js";

export interface TripBalanceRow {
  memberId: string;
  paid: number;
  share: number;
  net: number;
  outstanding: number;
}

/** Everything the Summary / SettleUp / Trips card need, from one read of the trip's money data. */
export function tripBalances(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
  settlements: readonly BalanceSettlement[],
): { total: number; rows: TripBalanceRow[]; transfers: SuggestedTransfer[] } {
  const outstanding = outstandingBalances(memberIds, expenses, settlements);
  const rows = netBalances(memberIds, expenses).map((r) => ({ ...r, outstanding: outstanding[r.memberId] ?? 0 }));
  return { total: totalSpent(expenses), rows, transfers: suggestTransfers(outstanding) };
}

/** Outstanding of one Member (Trips card, member removal check). */
export function outstandingOf(
  inputs: { memberIds: readonly string[]; expenses: readonly BalanceExpense[]; settlements: readonly BalanceSettlement[] },
  memberId: string,
): number {
  return outstandingBalances(inputs.memberIds, inputs.expenses, inputs.settlements)[memberId] ?? 0;
}
