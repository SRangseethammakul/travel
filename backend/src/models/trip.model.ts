import type { UpdateFilter } from "mongodb";
import { collections } from "../db/collections.js";
import type { TripDoc } from "../schemas/models.js";

export function findTripById(tripId: string): Promise<TripDoc | null> {
  return collections.trips().findOne({ _id: tripId });
}

export function findTripsByIds(tripIds: string[]): Promise<TripDoc[]> {
  return collections.trips().find({ _id: { $in: tripIds } }).toArray();
}

export async function insertTrip(trip: TripDoc): Promise<void> {
  await collections.trips().insertOne(trip);
}

export function updateTrip(tripId: string, update: UpdateFilter<TripDoc>): Promise<TripDoc | null> {
  return collections.trips().findOneAndUpdate({ _id: tripId }, update, { returnDocument: "after" });
}

/**
 * Delete Trip (docs/db/schema.md §5.5): the trip first, so every endpoint 404s from then on,
 * then every trip-scoped collection. Idempotent; no transaction. Tags are not deleted.
 * Returns the file keys of the deleted Documents so the caller can remove the files.
 */
export async function deleteTripCascade(tripId: string): Promise<string[]> {
  await collections.trips().deleteOne({ _id: tripId });
  const fileKeys = (await collections.documents().find({ tripId }, { projection: { fileKey: 1 } }).toArray()).map((d) => d.fileKey);
  await Promise.all([
    collections.members().deleteMany({ tripId }),
    collections.invites().deleteMany({ tripId }),
    collections.places().deleteMany({ tripId }),
    collections.planItems().deleteMany({ tripId }),
    collections.expenses().deleteMany({ tripId }),
    collections.settlements().deleteMany({ tripId }),
    collections.checklistItems().deleteMany({ tripId }),
    collections.activities().deleteMany({ tripId }),
    collections.documents().deleteMany({ tripId }),
  ]);
  return fileKeys;
}
