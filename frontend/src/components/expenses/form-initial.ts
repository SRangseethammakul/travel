import type { Expense, Member } from "@/lib/api/types";
import type { ExpenseFormInitial } from "./ExpenseForm";

/** Starting values of the AddExpense form: blank for a new expense, or restored from an existing one. */
export function expenseFormInitial(
  expense: Expense | null,
  opts: { me: Member; members: Member[]; defaultDate: string; slipName?: string | null },
): ExpenseFormInitial {
  if (!expense) {
    return {
      title: "",
      category: "food",
      payerId: opts.me.id,
      method: "promptpay",
      cardName: "",
      date: opts.defaultDate,
      amount: 0,
      splitMode: "equal",
      participantIds: opts.members.map((m) => m.id),
      amounts: {},
      weights: {},
      slipName: null,
    };
  }
  return {
    title: expense.title,
    category: expense.category,
    payerId: expense.payerId,
    method: expense.method,
    cardName: expense.cardName ?? "",
    date: expense.date,
    amount: expense.amount,
    splitMode: expense.splitMode,
    participantIds: expense.shares.map((s) => s.memberId),
    amounts: expense.splitMode === "amount" ? Object.fromEntries(expense.shares.map((s) => [s.memberId, s.amount])) : {},
    weights: Object.fromEntries(expense.shares.filter((s) => s.weight).map((s) => [s.memberId, s.weight!])),
    slipName: opts.slipName ?? null,
  };
}
