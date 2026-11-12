import { collections } from "../db/collections.js";

/**
 * Everything needed to compute Net Balance / Outstanding for one trip (docs/db/schema.md §6):
 * all Members (incl. pending/removed, since old Expenses may name them), expenses (projected),
 * settlements. Three reads, each on an index that starts with `tripId`.
 */
export async function loadBalanceInputs(tripId: string) {
  const [members, expenses, settlements] = await Promise.all([
    collections.members().find({ tripId }, { projection: { _id: 1 } }).toArray(),
    collections.expenses().find({ tripId }, { projection: { payerId: 1, amount: 1, shares: 1 } }).toArray(),
    collections.settlements().find({ tripId }, { projection: { fromId: 1, toId: 1, amount: 1, status: 1 } }).toArray(),
  ]);
  return { memberIds: members.map((m) => m._id), expenses, settlements };
}

/** True if any Expense or Settlement of the trip names this Member. */
export async function isMemberReferenced(tripId: string, memberId: string): Promise<boolean> {
  const [expense, settlement] = await Promise.all([
    collections.expenses().findOne({ tripId, $or: [{ payerId: memberId }, { "shares.memberId": memberId }] }, { projection: { _id: 1 } }),
    collections.settlements().findOne({ tripId, $or: [{ fromId: memberId }, { toId: memberId }] }, { projection: { _id: 1 } }),
  ]);
  return expense !== null || settlement !== null;
}
