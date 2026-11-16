import type { Filter } from "mongodb";
import { collections } from "../db/collections.js";
import { MAX_PLACE_PHOTOS, type PlaceDoc, type PlacePhotoDoc } from "../schemas/models.js";

export interface PlaceFilter {
  city?: string;
  area?: string;
  /** Any of these tag ids. */
  tagIds?: string[];
  /** Leave these Places out (the "ยังไม่จัดวัน" filter passes the scheduled ids). */
  excludeIds?: string[];
}

/** Places of a trip, oldest first. Filters run in the query (`places_trip_city_area`). */
export function findPlaces(tripId: string, f: PlaceFilter = {}): Promise<PlaceDoc[]> {
  const filter: Filter<PlaceDoc> = { tripId };
  if (f.city !== undefined) filter.city = f.city;
  if (f.area !== undefined) filter.area = f.area;
  if (f.tagIds?.length) filter.tagIds = { $in: f.tagIds };
  if (f.excludeIds) filter._id = { $nin: f.excludeIds };
  return collections.places().find(filter).sort({ createdAt: 1, _id: 1 }).toArray();
}

export function findPlace(tripId: string, placeId: string): Promise<PlaceDoc | null> {
  return collections.places().findOne({ _id: placeId, tripId });
}

/** How many of `ids` are Places of this trip. */
export function countPlacesInTrip(tripId: string, ids: string[]): Promise<number> {
  return collections.places().countDocuments({ tripId, _id: { $in: ids } });
}

export async function insertPlace(doc: PlaceDoc): Promise<void> {
  await collections.places().insertOne(doc);
}

export function updatePlace(
  tripId: string,
  placeId: string,
  set: Partial<PlaceDoc>,
  unset: (keyof PlaceDoc)[],
): Promise<PlaceDoc | null> {
  return collections
    .places()
    .findOneAndUpdate(
      { _id: placeId, tripId },
      { $set: set, ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, "" as const])) } : {}) },
      { returnDocument: "after" },
    );
}

export async function deletePlace(tripId: string, placeId: string): Promise<boolean> {
  const r = await collections.places().deleteOne({ _id: placeId, tripId });
  return r.deletedCount === 1;
}

/** Take an Expense off every stay Place that links it. */
export async function unlinkExpenseFromPlaces(tripId: string, expenseId: string): Promise<void> {
  await collections.places().updateMany({ tripId, "stay.expenseId": expenseId }, { $unset: { "stay.expenseId": "" } });
}

/** Tag ids used on any Place of the trip (may include ids of deleted tags). */
export function tripTagIds(tripId: string): Promise<string[]> {
  return collections.places().distinct("tagIds", { tripId });
}

/** Rename or merge an Area within one city. Returns how many Places changed. */
export async function renameArea(tripId: string, city: string, from: string, to: string | null): Promise<number> {
  const r = await collections.places().updateMany({ tripId, city, area: from }, { $set: { area: to, updatedAt: new Date() } });
  return r.modifiedCount;
}

/** Take a tag off every Place in every trip (`places_tagIds`). Returns how many Places had it. */
export async function pullTagFromPlaces(tagId: string): Promise<number> {
  const r = await collections.places().updateMany({ tagIds: tagId }, { $pull: { tagIds: tagId } });
  return r.modifiedCount;
}

/** Places (in any trip) carrying each tag; tags on no Place are left out. */
export async function countPlacesPerTag(tagIds: string[]): Promise<Record<string, number>> {
  if (!tagIds.length) return {};
  const rows = await collections
    .places()
    .aggregate<{ _id: string; n: number }>([
      { $match: { tagIds: { $in: tagIds } } },
      { $unwind: "$tagIds" },
      { $match: { tagIds: { $in: tagIds } } },
      { $group: { _id: "$tagIds", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

/** Appends a photo unless the Place already has the maximum. False = Place gone or full. */
export async function pushPlacePhoto(tripId: string, placeId: string, photo: PlacePhotoDoc): Promise<boolean> {
  const r = await collections
    .places()
    .updateOne({ _id: placeId, tripId, [`photos.${MAX_PLACE_PHOTOS - 1}`]: { $exists: false } }, { $push: { photos: photo } });
  return r.modifiedCount === 1;
}

/** Removes a photo from a Place. False = nothing removed (Place or photo already gone). */
export async function pullPlacePhoto(tripId: string, placeId: string, photoId: string): Promise<boolean> {
  const r = await collections.places().updateOne({ _id: placeId, tripId }, { $pull: { photos: { _id: photoId } } });
  return r.modifiedCount === 1;
}

/** Place by id alone, for the signed-URL route (no session there). */
export function findPlaceById(placeId: string): Promise<PlaceDoc | null> {
  return collections.places().findOne({ _id: placeId });
}
