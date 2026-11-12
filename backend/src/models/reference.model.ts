/**
 * Existence checks for ids a request links to (Documents, Expenses). Read-only, scoped to
 * one trip, so a client can never link another trip's document or expense.
 */
import { collections } from "../db/collections.js";

/** True when every id is a Document of this trip. */
export async function documentsExist(tripId: string, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (!unique.length) return true;
  return (await collections.documents().countDocuments({ tripId, _id: { $in: unique } })) === unique.length;
}

export async function expenseExists(tripId: string, expenseId: string): Promise<boolean> {
  return (await collections.expenses().countDocuments({ tripId, _id: expenseId })) === 1;
}
