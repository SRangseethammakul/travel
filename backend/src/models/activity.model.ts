import { collections } from "../db/collections.js";
import { newId } from "../db/ids.js";
import type { ActivityDoc } from "../schemas/models.js";

export type NewActivity = Pick<ActivityDoc, "tripId" | "actorId" | "type" | "refId" | "text">;

/** Every change records one Activity. Text is neutral; the UI swaps the viewer's own name for "คุณ". */
export async function addActivity(a: NewActivity): Promise<void> {
  await collections.activities().insertOne({ _id: newId(), ...a, createdAt: new Date(), readBy: [] });
}

/**
 * A16 — newest first, optional `type`, paginated by `createdAt` (`activities_trip_type_created` / `activities_trip_created`).
 * `before` alone is inclusive so Activities in the same millisecond are never skipped (the caller
 * dedupes by id); with `beforeId` the cursor is exact: (createdAt, _id) strictly before that item.
 */
function cursorFilter(before?: Date, beforeId?: string) {
  if (!before) return {};
  if (!beforeId) return { createdAt: { $lte: before } };
  return { $or: [{ createdAt: { $lt: before } }, { createdAt: before, _id: { $lt: beforeId } }] };
}

export function listActivities(
  tripId: string,
  opts: { type?: ActivityDoc["type"]; before?: Date; beforeId?: string; limit: number },
): Promise<ActivityDoc[]> {
  return collections
    .activities()
    .find({
      tripId,
      ...(opts.type ? { type: opts.type } : {}),
      ...cursorFilter(opts.before, opts.beforeId),
    })
    .sort({ createdAt: -1, _id: -1 })
    .limit(opts.limit)
    .toArray();
}

/** B39 — adds the User to `readBy` of the given Activities of the trip (all of them when `ids` is empty). */
export async function markActivitiesRead(tripId: string, userId: string, ids: string[]): Promise<void> {
  await collections
    .activities()
    .updateMany({ tripId, ...(ids.length ? { _id: { $in: ids } } : {}), readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
}
