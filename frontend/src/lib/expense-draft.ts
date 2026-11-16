/**
 * What the AddExpense form sends, and the check that turns it into Shares.
 * Pure (no store), so the Server Action and tests share it. The client never
 * sends Shares: they are always recomputed here with computeSplit.
 */
import type { ExpenseCategory, ID, PaymentMethod, Share, SplitMode } from "@/lib/api/types";
import { checkCardName } from "@/lib/card-name";
import { daysBetween, type ISODate } from "@/lib/date";
import type { Satang } from "@/lib/money/format";
import { computeSplit } from "@/lib/money/split";

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ["stay", "transport", "food", "activity", "other"];
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "promptpay", "card", "wallet"];
const SPLIT_MODES: readonly SplitMode[] = ["equal", "amount", "shares"];

/** Details of a newly picked slip, for the fast form check; the File itself goes to the Server Action. */
export interface SlipMeta {
  name: string;
  mime: string;
  size: number;
}

export interface ExpenseDraft {
  title: string;
  category: ExpenseCategory;
  payerId: ID;
  method: PaymentMethod;
  /** Card payments only; trimmed, at most 30 characters, "" = none. */
  cardName?: string;
  date: ISODate;
  amount: Satang;
  splitMode: SplitMode;
  /** Ticked members, in member order. */
  participantIds: ID[];
  /** `amount` mode. */
  amounts?: Record<ID, Satang>;
  /** `shares` mode. */
  weights?: Record<ID, number>;
  /** PromptPay only. undefined = keep the current slip, null = remove it. */
  slip?: SlipMeta | null;
}

export const MAX_TITLE = 80;
export const MAX_SLIP_BYTES = 10 * 1024 * 1024;

export type DraftResult =
  | { ok: true; title: string; shares: Share[]; cardName?: string }
  | { ok: false; error: string };

export function checkExpenseDraft(
  draft: ExpenseDraft,
  memberIds: readonly ID[],
  trip: { startDate: ISODate; endDate: ISODate },
): DraftResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: "ใส่ชื่อรายการ" };
  if (title.length > MAX_TITLE) return { ok: false, error: `ชื่อรายการยาวได้ไม่เกิน ${MAX_TITLE} ตัวอักษร` };
  if (!EXPENSE_CATEGORIES.includes(draft.category)) return { ok: false, error: "เลือกหมวดหมู่" };
  if (!PAYMENT_METHODS.includes(draft.method)) return { ok: false, error: "เลือกช่องทางชำระเงิน" };
  if (!SPLIT_MODES.includes(draft.splitMode)) return { ok: false, error: "เลือกวิธีหาร" };
  if (!memberIds.includes(draft.payerId)) return { ok: false, error: "เลือกคนจ่าย" };
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) return { ok: false, error: "ใส่จำนวนเงินมากกว่า 0" };
  if (!draft.participantIds.length) return { ok: false, error: "เลือกคนที่ร่วมหารอย่างน้อย 1 คน" };
  if (draft.participantIds.some((id) => !memberIds.includes(id))) return { ok: false, error: "มีคนที่ไม่ได้อยู่ในทริปนี้" };
  if (daysBetween(trip.startDate, draft.date) < 0 || daysBetween(draft.date, trip.endDate) < 0) {
    return { ok: false, error: "เลือกวันที่ภายในช่วงทริป" };
  }
  const card = checkCardName(draft.method === "card" ? draft.cardName : undefined);
  if (!card.ok) return card;
  if (draft.slip && (draft.slip.size > MAX_SLIP_BYTES || !/^(image\/|application\/pdf$)/.test(draft.slip.mime))) {
    return { ok: false, error: "สลิปต้องเป็นรูปหรือ PDF ขนาดไม่เกิน 10 MB" };
  }

  let split;
  try {
    split = computeSplit({
      mode: draft.splitMode,
      total: draft.amount,
      payerId: draft.payerId,
      participantIds: draft.participantIds,
      amounts: draft.amounts,
      weights: draft.weights,
    });
  } catch {
    return { ok: false, error: "ข้อมูลการหารไม่ถูกต้อง" };
  }
  if (!split.balanced) return { ok: false, error: "ยอดที่แบ่งยังไม่ตรงกับจำนวนเงิน" };
  return { ok: true, title, shares: split.shares, ...(card.cardName ? { cardName: card.cardName } : {}) };
}

/** Default date for a new expense: today when inside the trip, else the nearest trip day. */
export function defaultExpenseDate(today: ISODate, trip: { startDate: ISODate; endDate: ISODate }): ISODate {
  if (daysBetween(today, trip.startDate) > 0) return trip.startDate;
  if (daysBetween(trip.endDate, today) > 0) return trip.endDate;
  return today;
}
