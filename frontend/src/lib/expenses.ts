/**
 * Expenses list and Summary helpers (pure, money in satang).
 */
import type { Activity, Expense, ExpenseCategory, ID, PersonalExpenseCategory, Settlement } from "@/lib/api/types";
import { daysBetween, formatDayMonth, type ISODate } from "@/lib/date";
import type { Satang } from "@/lib/money/format";

/** Anything dated with an amount: group Expenses and Personal Expenses. */
type ExpenseLike = Pick<Expense, "id" | "date" | "amount">;

export interface ExpenseDay<E> {
  date: ISODate;
  /** Trip day (1-based), or null when the date is outside the trip (e.g. booked beforehand). */
  day: number | null;
  /** "ส. 12 ธ.ค. · วันที่ 1" */
  label: string;
  total: Satang;
  items: E[];
}

/** Expenses grouped by date, oldest day first; order inside a day is kept. */
export function groupExpensesByDay<E extends ExpenseLike>(
  expenses: readonly E[],
  trip: { startDate: ISODate; endDate: ISODate },
): ExpenseDay<E>[] {
  const days = new Map<ISODate, ExpenseDay<E>>();
  for (const e of expenses) {
    let d = days.get(e.date);
    if (!d) {
      const offset = daysBetween(trip.startDate, e.date);
      const inTrip = offset >= 0 && e.date <= trip.endDate;
      const day = inTrip ? offset + 1 : null;
      d = { date: e.date, day, label: day ? `${formatDayMonth(e.date)} · วันที่ ${day}` : formatDayMonth(e.date), total: 0, items: [] };
      days.set(e.date, d);
    }
    d.items.push(e);
    d.total += e.amount;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * "คนละ ฿350" when every Share is the same, allowing the 1-satang remainder
 * that equal splits put on the payer. Null for uneven splits.
 */
export function equalShareAmount(e: Pick<Expense, "amount" | "shares">): Satang | null {
  if (!e.shares.length) return null;
  const amounts = e.shares.map((s) => s.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  // Equal splits differ by at most (n − 1) satang, all of it on one person.
  return max - min <= amounts.length - 1 ? min : null;
}

export interface CategoryTotal<C extends string = ExpenseCategory> {
  category: C;
  amount: Satang;
  /** Share of the total, rounded to a whole percent for labels (bar widths use the exact ratio). */
  percent: number;
}

/** Spending per category, largest first. */
export function categoryTotals<C extends string = ExpenseCategory>(
  expenses: readonly { category: C; amount: Satang }[],
): CategoryTotal<C>[] {
  const sums = new Map<C, Satang>();
  for (const e of expenses) sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount);
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  return [...sums]
    .map(([category, amount]) => ({ category, amount, percent: Math.round((amount * 100) / total) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Personal view header: the Member's own spending, total and per category (largest first). */
export function personalTotals(records: readonly { category: PersonalExpenseCategory; amount: Satang }[]): {
  total: Satang;
  byCategory: CategoryTotal<PersonalExpenseCategory>[];
} {
  return { total: records.reduce((sum, r) => sum + r.amount, 0), byCategory: categoryTotals(records) };
}

export interface ShareLine {
  expenseId: ID;
  title: string;
  /** "÷4" for equal splits, "2/5 ส่วน" for shares, "" for fixed amounts. */
  basis: string;
  amount: Satang;
}

/** Where a Member's share comes from (Summary row, expanded). */
export function shareBreakdown(
  memberId: ID,
  expenses: readonly Pick<Expense, "id" | "title" | "splitMode" | "shares">[],
): ShareLine[] {
  const out: ShareLine[] = [];
  for (const e of expenses) {
    const s = e.shares.find((x) => x.memberId === memberId);
    if (!s) continue;
    let basis = "";
    if (e.splitMode === "equal") basis = `÷${e.shares.length}`;
    else if (e.splitMode === "shares" && s.weight) {
      basis = `${s.weight}/${e.shares.reduce((a, x) => a + (x.weight ?? 0), 0)} ส่วน`;
    }
    out.push({ expenseId: e.id, title: e.title, basis, amount: s.amount });
  }
  return out;
}

export type TransferStatus = "confirmed" | "sent" | "pending";

export interface TransferRow {
  key: string;
  fromId: ID;
  toId: ID;
  amount: Satang;
  status: TransferStatus;
}

/**
 * "ใครต้องโอนให้ใคร": Settlements that are already confirmed (เคลียร์แล้ว),
 * then the Suggested Transfers from Outstanding (รอยืนยัน when a matching
 * Settlement was sent, otherwise โอนเงิน). Ordered by the payer's member order.
 */
/**
 * One Suggested Transfer as a `transferRows` input. While a report is `sent`
 * the row shows the reported amount (it may be lower than the suggestion).
 */
export function suggestedRow(t: {
  from: { id: ID };
  to: { id: ID };
  amount: Satang;
  settlement: Pick<Settlement, "amount" | "status"> | null;
}): { fromId: ID; toId: ID; amount: Satang; settlementStatus: Settlement["status"] | null } {
  const sent = t.settlement?.status === "sent";
  return { fromId: t.from.id, toId: t.to.id, amount: sent ? t.settlement!.amount : t.amount, settlementStatus: t.settlement?.status ?? null };
}

export function transferRows(
  memberOrder: readonly ID[],
  settlements: readonly Pick<Settlement, "id" | "fromId" | "toId" | "amount" | "status">[],
  suggested: readonly { fromId: ID; toId: ID; amount: Satang; settlementStatus: Settlement["status"] | null }[],
): TransferRow[] {
  const rows: TransferRow[] = [
    ...settlements
      .filter((s) => s.status === "confirmed")
      .map((s) => ({ key: s.id, fromId: s.fromId, toId: s.toId, amount: s.amount, status: "confirmed" as const })),
    ...suggested.map((t) => ({
      key: `${t.fromId}>${t.toId}`,
      fromId: t.fromId,
      toId: t.toId,
      amount: t.amount,
      status: (t.settlementStatus === "sent" ? "sent" : "pending") as TransferStatus,
    })),
  ];
  const rank = (id: ID) => {
    const i = memberOrder.indexOf(id);
    return i < 0 ? memberOrder.length : i;
  };
  return rows.sort((a, b) => rank(a.fromId) - rank(b.fromId));
}

/** Unread Activity for the bell: not read by this User and not done by their own Member. */
export function unreadCount(activity: readonly Pick<Activity, "actorId" | "readBy">[], userId: ID, memberId: ID): number {
  return activity.filter((a) => a.actorId !== memberId && !a.readBy.includes(userId)).length;
}
