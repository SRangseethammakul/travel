/** Server copy of frontend/src/lib/money/split.ts rules (interim: not shared yet). All amounts are satang. */

export type SplitMode = "equal" | "amount" | "shares";

export interface ShareInput {
  memberId: string;
  /** `amount` mode only. */
  amount?: number;
  /** `shares` mode only; missing = 1. */
  weight?: number;
}

export interface Share {
  memberId: string;
  amount: number;
  weight?: number;
}

/** The shares cannot add up to the Expense amount; controllers turn this into 400. */
export class SplitError extends Error {}

function assertSatang(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new SplitError(`${label} must be non-negative integer satang`);
}

/** Leftover satang goes to the payer if they share, otherwise the first listed member. */
function remainderRecipient(payerId: string, memberIds: readonly string[]): string {
  return memberIds.includes(payerId) ? payerId : memberIds[0]!;
}

/**
 * Resolves every Share's amount for an Expense and checks they sum exactly to `total`.
 * - `equal` / `shares`: amounts are computed; leftover satang goes to the payer (or first member).
 * - `amount`: amounts are taken as given and must sum exactly.
 */
export function split(input: { mode: SplitMode; total: number; payerId: string; shares: readonly ShareInput[] }): Share[] {
  const { mode, total, payerId, shares } = input;
  assertSatang(total, "total");
  if (total === 0) throw new SplitError("total must be greater than 0");
  if (shares.length === 0) throw new SplitError("at least one member must share the expense");
  const ids = shares.map((s) => s.memberId);
  if (new Set(ids).size !== ids.length) throw new SplitError("each member may appear once");

  if (mode === "amount") {
    const result = shares.map((s) => {
      const amount = s.amount ?? 0;
      assertSatang(amount, `amount for ${s.memberId}`);
      return { memberId: s.memberId, amount };
    });
    const sum = result.reduce((acc, s) => acc + s.amount, 0);
    if (sum !== total) throw new SplitError(`shares sum to ${sum}, expected ${total}`);
    return result;
  }

  const weights = shares.map((s) => (mode === "shares" ? (s.weight ?? 1) : 1));
  if (weights.some((w) => !Number.isInteger(w) || w < 1)) throw new SplitError("weights must be positive integers");
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const result: Share[] = shares.map((s, i) => ({
    memberId: s.memberId,
    amount: Math.floor((total * weights[i]!) / totalWeight),
    ...(mode === "shares" ? { weight: weights[i]! } : {}),
  }));
  const leftover = total - result.reduce((acc, s) => acc + s.amount, 0);
  const to = remainderRecipient(payerId, ids);
  result.find((s) => s.memberId === to)!.amount += leftover;
  return result;
}
