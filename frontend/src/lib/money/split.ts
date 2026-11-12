import { type Satang, assertSatang } from "./format";

export type SplitMode = "equal" | "amount" | "shares";

export interface ShareLine {
  memberId: string;
  amount: Satang;
  /** Only set for `shares` mode. */
  weight?: number;
}

export interface SplitInput {
  mode: SplitMode;
  /** Full expense amount in satang. */
  total: Satang;
  payerId: string;
  /** Members who share this expense, in display (tick) order. */
  participantIds: readonly string[];
  /** `amount` mode: what each participant typed, in satang. Missing = 0. */
  amounts?: Readonly<Record<string, Satang>>;
  /** `shares` mode: number of parts per participant. Missing = 1. */
  weights?: Readonly<Record<string, number>>;
}

export interface SplitResult {
  shares: ShareLine[];
  /** Sum of all share lines. */
  allocated: Satang;
  /** total − allocated: > 0 means still unallocated, < 0 means over-allocated. */
  remaining: Satang;
  /** Remainder satang added to one member by `equal` / `shares` (0 if exact). */
  roundingRemainder: Satang;
  /** Who received the rounding remainder (payer if participating, else first participant). */
  remainderTo: string | null;
  /** Shares sum exactly to the total and there is at least one participant. */
  balanced: boolean;
}

/** Remainder goes to the payer if they share the expense, otherwise the first participant (mockup rule). */
export function remainderRecipient(payerId: string, participantIds: readonly string[]): string | null {
  if (participantIds.includes(payerId)) return payerId;
  return participantIds[0] ?? null;
}

function weightOf(weights: SplitInput["weights"], id: string): number {
  const w = weights?.[id] ?? 1;
  if (!Number.isInteger(w) || w < 1) throw new RangeError(`weight for ${id} must be a positive integer`);
  return w;
}

export function computeSplit(input: SplitInput): SplitResult {
  const { mode, total, payerId, participantIds } = input;
  assertSatang(total, "total");
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("participantIds must be unique");
  }

  const n = participantIds.length;
  let lines: ShareLine[];
  let roundingRemainder = 0;
  let remainderTo: string | null = null;

  if (mode === "amount") {
    lines = participantIds.map((memberId) => {
      const amount = input.amounts?.[memberId] ?? 0;
      assertSatang(amount, `amount for ${memberId}`);
      return { memberId, amount };
    });
  } else {
    const weights = participantIds.map((id) => (mode === "shares" ? weightOf(input.weights, id) : 1));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    lines = participantIds.map((memberId, i) => ({
      memberId,
      amount: totalWeight ? Math.floor((total * weights[i]) / totalWeight) : 0,
      ...(mode === "shares" ? { weight: weights[i] } : {}),
    }));
    const used = lines.reduce((s, l) => s + l.amount, 0);
    roundingRemainder = total - used;
    remainderTo = remainderRecipient(payerId, participantIds);
    if (roundingRemainder > 0 && remainderTo) {
      const target = lines.find((l) => l.memberId === remainderTo)!;
      target.amount += roundingRemainder;
    }
  }

  const allocated = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = total - allocated;
  return {
    shares: lines,
    allocated,
    remaining,
    roundingRemainder,
    remainderTo: roundingRemainder > 0 ? remainderTo : null,
    balanced: n > 0 && total > 0 && remaining === 0,
  };
}

/**
 * "เกลี่ยส่วนที่เหลือ" for `amount` mode: spread the unallocated satang over the
 * participants that are still empty (or everyone if nobody is empty). Any
 * remainder goes to the first member of that pool — as in the AddExpense mockup.
 * Returns the amounts unchanged when nothing is left to spread.
 */
export function spreadRemaining(
  total: Satang,
  participantIds: readonly string[],
  amounts: Readonly<Record<string, Satang>>,
): Record<string, Satang> {
  assertSatang(total, "total");
  const next: Record<string, Satang> = { ...amounts };
  const used = participantIds.reduce((s, id) => s + (amounts[id] ?? 0), 0);
  const diff = total - used;
  if (diff <= 0 || participantIds.length === 0) return next;

  const empties = participantIds.filter((id) => !amounts[id]);
  const pool = empties.length ? empties : [...participantIds];
  const each = Math.floor(diff / pool.length);
  const rest = diff - each * pool.length;
  pool.forEach((id, i) => {
    next[id] = (amounts[id] ?? 0) + each + (i === 0 ? rest : 0);
  });
  return next;
}

/** True when every share is a non-negative integer and they sum exactly to the total. */
export function sharesMatchTotal(total: Satang, shares: readonly { amount: Satang }[]): boolean {
  if (shares.length === 0 || total <= 0) return false;
  let sum = 0;
  for (const s of shares) {
    if (!Number.isSafeInteger(s.amount) || s.amount < 0) return false;
    sum += s.amount;
  }
  return sum === total;
}
