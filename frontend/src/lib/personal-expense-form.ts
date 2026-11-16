/**
 * Personal Expense form check (pure, shared by the Server Action and tests).
 * Only for fast feedback: the backend decides and its Thai message is shown when it refuses.
 */
import type { PaymentMethod, PersonalExpenseCategory } from "@/lib/api/types";
import { checkCardName } from "@/lib/card-name";
import { daysBetween, type ISODate } from "@/lib/date";
import { PAYMENT_METHODS } from "@/lib/expense-draft";
import type { Satang } from "@/lib/money/format";

/** Group categories plus "shopping", in pill order. */
export const PERSONAL_EXPENSE_CATEGORIES: readonly PersonalExpenseCategory[] = ["shopping", "food", "transport", "activity", "stay", "other"];

/** Backend limits (B45). */
export const MAX_PERSONAL_TITLE = 200;
export const MAX_PERSONAL_NOTE = 2000;

export interface PersonalExpenseDraft {
  title: string;
  category: PersonalExpenseCategory;
  amount: Satang;
  method: PaymentMethod;
  /** Card payments only; trimmed on check, "" = none. */
  cardName?: string;
  date: ISODate;
  note: string;
}

/** Body for B45/B46. `note` is null when empty (PATCH clears it; POST leaves it out). */
export interface PersonalExpenseInput {
  title: string;
  category: PersonalExpenseCategory;
  amount: Satang;
  method: PaymentMethod;
  /** null when there is none (PATCH removes it; POST leaves it out). */
  cardName: string | null;
  date: ISODate;
  note: string | null;
}

export type PersonalDraftResult = { ok: true; value: PersonalExpenseInput } | { ok: false; error: string };

export function checkPersonalExpenseDraft(
  draft: PersonalExpenseDraft,
  trip: { startDate: ISODate; endDate: ISODate },
): PersonalDraftResult {
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) return { ok: false, error: "ใส่จำนวนเงินมากกว่า 0" };
  const title = draft.title.trim();
  if (!title) return { ok: false, error: "ใส่ชื่อรายการ" };
  if (title.length > MAX_PERSONAL_TITLE) return { ok: false, error: `ชื่อรายการยาวได้ไม่เกิน ${MAX_PERSONAL_TITLE} ตัวอักษร` };
  if (!PERSONAL_EXPENSE_CATEGORIES.includes(draft.category)) return { ok: false, error: "เลือกหมวดหมู่" };
  if (!PAYMENT_METHODS.includes(draft.method)) return { ok: false, error: "เลือกช่องทางชำระเงิน" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || daysBetween(trip.startDate, draft.date) < 0 || daysBetween(draft.date, trip.endDate) < 0) {
    return { ok: false, error: "เลือกวันที่ภายในช่วงทริป" };
  }
  const card = checkCardName(draft.method === "card" ? draft.cardName : undefined);
  if (!card.ok) return card;
  const note = draft.note.trim();
  if (note.length > MAX_PERSONAL_NOTE) return { ok: false, error: `โน้ตยาวได้ไม่เกิน ${MAX_PERSONAL_NOTE} ตัวอักษร` };
  return {
    ok: true,
    value: { title, category: draft.category, amount: draft.amount, method: draft.method, cardName: card.cardName ?? null, date: draft.date, note: note || null },
  };
}
