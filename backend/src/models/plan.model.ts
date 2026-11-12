import { collections } from "../db/collections.js";
import type { PlanItemDoc } from "../schemas/models.js";

/** Every Plan Item of a trip; the app sorts them (see domain/plan.ts). */
export function findPlanItems(tripId: string): Promise<PlanItemDoc[]> {
  return collections.planItems().find({ tripId }).toArray();
}

export function findPlanItem(tripId: string, itemId: string): Promise<PlanItemDoc | null> {
  return collections.planItems().findOne({ _id: itemId, tripId });
}

export async function insertPlanItems(docs: PlanItemDoc[]): Promise<void> {
  await collections.planItems().insertMany(docs);
}

export function updatePlanItem(
  tripId: string,
  itemId: string,
  set: Record<string, unknown>,
  unset: string[],
): Promise<PlanItemDoc | null> {
  const update = {
    ...(Object.keys(set).length ? { $set: set } : {}),
    ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, "" as const])) } : {}),
  };
  if (!Object.keys(update).length) return findPlanItem(tripId, itemId);
  return collections.planItems().findOneAndUpdate({ _id: itemId, tripId }, update, { returnDocument: "after" });
}

export async function deletePlanItem(tripId: string, itemId: string): Promise<boolean> {
  const r = await collections.planItems().deleteOne({ _id: itemId, tripId });
  return r.deletedCount === 1;
}

/** Place ids in the plan, as a visit or as a Transit endpoint (everything else is Unscheduled). */
export async function scheduledPlaceIds(tripId: string): Promise<Set<string>> {
  const items = await collections
    .planItems()
    .find({ tripId }, { projection: { placeId: 1, fromPlaceId: 1, toPlaceId: 1 } })
    .toArray();
  const ids = new Set<string>();
  for (const i of items as Partial<Record<"placeId" | "fromPlaceId" | "toPlaceId", string>>[]) {
    for (const id of [i.placeId, i.fromPlaceId, i.toPlaceId]) if (id) ids.add(id);
  }
  return ids;
}

/** Transits that start or end at this Place. */
export function countTransitsAtPlace(tripId: string, placeId: string): Promise<number> {
  return collections.planItems().countDocuments({ tripId, kind: "transit", $or: [{ fromPlaceId: placeId }, { toPlaceId: placeId }] });
}

/** Removes every visit of a Place. */
export async function deleteVisitsOfPlace(tripId: string, placeId: string): Promise<void> {
  await collections.planItems().deleteMany({ tripId, kind: "place", placeId });
}

/** A deleted Expense is unlinked from its Transit cards. */
export async function unlinkExpense(tripId: string, expenseId: string): Promise<void> {
  await collections.planItems().updateMany({ tripId, expenseId }, { $unset: { expenseId: "" } });
}
