import type { UpdateFilter } from "mongodb";
import { collections } from "../db/collections.js";
import { newId } from "../db/ids.js";
import { GROUP_TEMPLATE, PERSONAL_TEMPLATE } from "../domain/checklist.js";
import type { ChecklistItemDoc } from "../schemas/models.js";

/**
 * What a Member may see: group items + their own personal items. The `ownerId` filter is part
 * of the query itself (never filtered after fetching). Uses `checklist_trip_scope_owner`.
 */
export function visibleChecklistFilter(tripId: string, memberId: string) {
  return { tripId, $or: [{ scope: "group" as const }, { scope: "personal" as const, ownerId: memberId }] };
}

export function listChecklist(tripId: string, memberId: string): Promise<ChecklistItemDoc[]> {
  return collections.checklistItems().find(visibleChecklistFilter(tripId, memberId)).sort({ createdAt: 1, _id: 1 }).toArray();
}

export function findVisibleChecklistItem(tripId: string, memberId: string, itemId: string): Promise<ChecklistItemDoc | null> {
  return collections.checklistItems().findOne({ _id: itemId, ...visibleChecklistFilter(tripId, memberId) });
}

export async function insertChecklistItem(item: ChecklistItemDoc): Promise<void> {
  await collections.checklistItems().insertOne(item);
}

export function updateChecklistItem(tripId: string, itemId: string, update: UpdateFilter<ChecklistItemDoc>): Promise<ChecklistItemDoc | null> {
  return collections.checklistItems().findOneAndUpdate({ _id: itemId, tripId }, update, { returnDocument: "after" });
}

export async function deleteChecklistItem(tripId: string, itemId: string): Promise<void> {
  await collections.checklistItems().deleteOne({ _id: itemId, tripId });
}

/** Default items: group items for a new trip and/or personal items for a new Member. */
export async function insertTemplateItems(tripId: string, opts: { group: boolean; personalFor?: string }): Promise<void> {
  const createdAt = new Date();
  const items: ChecklistItemDoc[] = [
    ...(opts.group ? GROUP_TEMPLATE.map((t) => ({ ...t, scope: "group" as const })) : []),
    ...(opts.personalFor ? PERSONAL_TEMPLATE.map((t) => ({ ...t, scope: "personal" as const, ownerId: opts.personalFor })) : []),
  ].map((t) => ({ _id: newId(), tripId, ...t, done: false, fromTemplate: true, createdAt }));
  if (items.length > 0) await collections.checklistItems().insertMany(items);
}

/** When a Member is hard-deleted: drop their personal items and unassign group items. */
export async function removeMemberFromChecklist(tripId: string, memberId: string): Promise<void> {
  await collections.checklistItems().deleteMany({ tripId, scope: "personal", ownerId: memberId });
  await collections.checklistItems().updateMany({ tripId, assigneeId: memberId }, { $unset: { assigneeId: "" } });
}
