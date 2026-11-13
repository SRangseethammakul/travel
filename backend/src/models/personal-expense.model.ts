import type { UpdateFilter } from "mongodb";
import { collections } from "../db/collections.js";
import type { PersonalExpenseDoc } from "../schemas/models.js";

/**
 * Personal Expenses are private: every query filters on `ownerId` in the query itself
 * (never after fetching). Uses `personalExpenses_trip_owner_date`.
 */
export function listPersonalExpenses(tripId: string, ownerId: string): Promise<PersonalExpenseDoc[]> {
  return collections.personalExpenses().find({ tripId, ownerId }).sort({ date: 1, createdAt: 1 }).toArray();
}

export async function insertPersonalExpense(doc: PersonalExpenseDoc): Promise<void> {
  await collections.personalExpenses().insertOne(doc);
}

/** null when the record does not exist or belongs to someone else. */
export function updatePersonalExpense(
  tripId: string,
  ownerId: string,
  id: string,
  update: UpdateFilter<PersonalExpenseDoc>,
): Promise<PersonalExpenseDoc | null> {
  return collections.personalExpenses().findOneAndUpdate({ _id: id, tripId, ownerId }, update, { returnDocument: "after" });
}

/** false when the record does not exist or belongs to someone else. */
export async function deletePersonalExpense(tripId: string, ownerId: string, id: string): Promise<boolean> {
  return (await collections.personalExpenses().deleteOne({ _id: id, tripId, ownerId })).deletedCount === 1;
}

/** When a Member is hard-deleted: drop their Personal Expenses. */
export async function removeMemberPersonalExpenses(tripId: string, memberId: string): Promise<void> {
  await collections.personalExpenses().deleteMany({ tripId, ownerId: memberId });
}
