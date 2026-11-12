import { collections } from "../db/collections.js";
import type { ExpenseDoc } from "../schemas/models.js";

/** A11 — by date, then createdAt (`expenses_trip_date`, fully index-ordered). */
export function findExpenses(tripId: string): Promise<ExpenseDoc[]> {
  return collections
    .expenses()
    .find({ tripId })
    .sort({ date: 1, createdAt: 1 })
    .toArray();
}

export function findExpense(tripId: string, expenseId: string): Promise<ExpenseDoc | null> {
  return collections.expenses().findOne({ _id: expenseId, tripId });
}

export async function insertExpense(doc: ExpenseDoc): Promise<void> {
  await collections.expenses().insertOne(doc);
}

/** Writes the whole Expense at once, so the Shares and the amount always change together. */
export function replaceExpense(doc: ExpenseDoc): Promise<ExpenseDoc | null> {
  return collections.expenses().findOneAndReplace({ _id: doc._id, tripId: doc.tripId }, doc, { returnDocument: "after" });
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<boolean> {
  const r = await collections.expenses().deleteOne({ _id: expenseId, tripId });
  return r.deletedCount === 1;
}
