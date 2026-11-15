/**
 * Expenses list and Summary helpers (pure, money in satang).
 */
import type { Activity, Expense, ExpenseCategory, ID, Member, PersonalExpenseCategory, Role, Settlement } from "@/lib/api/types";
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

/** Caption under an Expense row's amount (Expenses list). */
export type ShareCaption =
  | { kind: "each"; amount: Satang; approx: boolean }
  | { kind: "mine"; amount: Satang }
  | { kind: "uneven" };

/**
 * "คนละ ฿350" only when every Share is exactly the same. An equal split with a
 * satang remainder (฿100.01 → 50.01 / 50.00) shows the viewer's own Share, or
 * "คนละ ~฿50" when they are not in it. Uneven splits show the viewer's Share.
 */
export function shareCaption(e: Pick<Expense, "amount" | "shares">, meId: ID): ShareCaption {
  const each = equalShareAmount(e);
  const mine = e.shares.find((s) => s.memberId === meId)?.amount;
  if (each !== null && e.shares.every((s) => s.amount === each)) return { kind: "each", amount: each, approx: false };
  if (mine !== undefined) return { kind: "mine", amount: mine };
  return each !== null ? { kind: "each", amount: each, approx: true } : { kind: "uneven" };
}

/**
 * ExpenseDetail line shown when the viewer cannot edit: who can. A viewer is told
 * their role; a creator who is now a viewer can no longer edit either.
 */
export function expenseEditHint(meRole: Role, creator: Pick<Member, "displayName" | "role"> | undefined): string {
  if (meRole === "viewer") return "คุณดูได้อย่างเดียว แก้หรือลบรายการนี้ได้เฉพาะผู้จัดทริป";
  if (creator?.role === "editor") return `แก้หรือลบได้เฉพาะ ${creator.displayName} ที่เพิ่มรายการนี้ หรือผู้จัดทริป`;
  return "แก้หรือลบได้เฉพาะผู้จัดทริป";
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

/**
 * "waiting": what is left of a pair while a partial report is still `sent`. The
 * backend allows one open Settlement per pair (409 `already_sent`), so it can be
 * reported only after the receiver confirms.
 */
export type TransferStatus = "confirmed" | "sent" | "pending" | "waiting";

export interface TransferRow {
  key: string;
  fromId: ID;
  toId: ID;
  amount: Satang;
  status: TransferStatus;
}

/** A Suggested Transfer as a `transferRows` input; `sentAmount` is the open report, if any. */
export interface SuggestedRow {
  fromId: ID;
  toId: ID;
  /** What `fromId` still owes `toId` (from Outstanding; a `sent` report does not lower it). */
  amount: Satang;
  sentAmount: Satang | null;
}

/** One A14 transfer as a `transferRows` input. */
export function suggestedRow(t: {
  from: { id: ID };
  to: { id: ID };
  amount: Satang;
  settlement: Pick<Settlement, "amount" | "status"> | null;
}): SuggestedRow {
  return { fromId: t.from.id, toId: t.to.id, amount: t.amount, sentAmount: t.settlement?.status === "sent" ? t.settlement.amount : null };
}

/**
 * "ใครต้องโอนให้ใคร": Settlements that are already confirmed (เคลียร์แล้ว),
 * then the Suggested Transfers from Outstanding (โอนเงิน). While a report is
 * `sent` the pair shows the reported amount (รอยืนยัน), followed by what is
 * left when the report was partial (waiting). Ordered by the payer's member order.
 */
export function transferRows(
  memberOrder: readonly ID[],
  settlements: readonly Pick<Settlement, "id" | "fromId" | "toId" | "amount" | "status">[],
  suggested: readonly SuggestedRow[],
): TransferRow[] {
  const rows: TransferRow[] = settlements
    .filter((s) => s.status === "confirmed")
    .map((s) => ({ key: s.id, fromId: s.fromId, toId: s.toId, amount: s.amount, status: "confirmed" as const }));
  for (const t of suggested) {
    const key = `${t.fromId}>${t.toId}`;
    if (t.sentAmount === null) {
      rows.push({ key, fromId: t.fromId, toId: t.toId, amount: t.amount, status: "pending" });
      continue;
    }
    rows.push({ key, fromId: t.fromId, toId: t.toId, amount: t.sentAmount, status: "sent" });
    const left = t.amount - t.sentAmount;
    if (left > 0) rows.push({ key: `${key}:rest`, fromId: t.fromId, toId: t.toId, amount: left, status: "waiting" });
  }
  const rank = (id: ID) => {
    const i = memberOrder.indexOf(id);
    return i < 0 ? memberOrder.length : i;
  };
  // Stable sort: a pair's sent row stays before its waiting row.
  return rows.sort((a, b) => rank(a.fromId) - rank(b.fromId));
}

/** Unread Activity for the bell: not read by this User and not done by their own Member. */
export function unreadCount(activity: readonly Pick<Activity, "actorId" | "readBy">[], userId: ID, memberId: ID): number {
  return activity.filter((a) => a.actorId !== memberId && !a.readBy.includes(userId)).length;
}
