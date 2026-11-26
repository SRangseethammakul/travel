/**
 * "บันทึกเป็นค่าใช้จ่ายด้วย" on a hotel: the Expense that is created in the same
 * save, and the wording that tells the user how it will be split. Pure.
 */
import type { ExpenseDraft } from "@/lib/expense-draft";
import { defaultExpenseDate } from "@/lib/expense-draft";
import type { ID } from "@/lib/api/types";
import type { ISODate } from "@/lib/date";
import { formatMoney, type Satang } from "@/lib/money/format";
import { computeSplit } from "@/lib/money/split";

/** The same prefill as AddExpense opened with `?stay=`, paid by `payerId`, split equally between all members. */
export function stayExpenseDraft(input: {
  placeName: string;
  stay: { checkIn: ISODate; price: Satang };
  trip: { startDate: ISODate; endDate: ISODate };
  payerId: ID;
  memberIds: readonly ID[];
}): ExpenseDraft {
  return {
    title: `ที่พัก ${input.placeName}`,
    category: "stay",
    payerId: input.payerId,
    method: "promptpay",
    date: defaultExpenseDate(input.stay.checkIn, input.trip),
    amount: input.stay.price,
    splitMode: "equal",
    participantIds: [...input.memberIds],
  };
}

/** What each of `count` members pays. `approx` when satang are left over (the payer carries them). */
export function equalShare(amount: Satang, count: number): { each: Satang; approx: boolean } {
  const ids = Array.from({ length: Math.max(1, count) }, (_, i) => String(i));
  const split = computeSplit({ mode: "equal", total: amount, payerId: ids[0]!, participantIds: ids });
  return { each: Math.min(...split.shares.map((s) => s.amount)), approx: split.roundingRemainder > 0 };
}

/** "หาร 4 คน คนละ ฿1,350" (with "~" when it does not divide evenly). */
export function stayExpenseSplitText(amount: Satang, count: number): string {
  const { each, approx } = equalShare(amount, count);
  return `หาร ${count} คน คนละ ${approx ? "~" : ""}${formatMoney(each)}`;
}

/** Toast after a hotel and its expense are saved together. */
export function stayExpenseSavedText(prefix: string, amount: Satang, count: number): string {
  return `${prefix} ${formatMoney(amount)} แล้ว (${stayExpenseSplitText(amount, count)})`;
}
