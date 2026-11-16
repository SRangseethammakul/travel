import type { PlaceDoc, PlacePhotoDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

/** A photo as the API returns it: no `fileKey`, plus a freshly signed URL. */
export function placePhotoView(photo: PlacePhotoDoc, signed: { url: string; expiresAt: Date }) {
  return {
    id: photo._id,
    mime: photo.mime,
    size: photo.size,
    uploadedBy: photo.uploadedBy,
    createdAt: photo.createdAt.toISOString(),
    url: signed.url,
    urlExpiresAt: signed.expiresAt.toISOString(),
  };
}
export type PlacePhotoView = ReturnType<typeof placePhotoView>;

/** `photos` (already signed by the controller) replaces the stored ones, which carry `fileKey`s. */
export function placeView(doc: PlaceDoc, photos: PlacePhotoView[] = []) {
  return { ...serialize({ ...doc, photos: undefined }), photos };
}

/**
 * Places grouped by Area or by type, in first-seen order, e.g. "Shinjuku · 4 ที่ · ลงแผน 3".
 * `key` is the Area (null = "ไม่ระบุย่าน") or the PlaceType. `photosOf` gives a Place's signed photos.
 */
export function placeGroupsView(
  places: PlaceDoc[],
  by: "area" | "type",
  scheduled: ReadonlySet<string>,
  photosOf: ReadonlyMap<string, PlacePhotoView[]>,
) {
  const groups = new Map<string | null, PlaceDoc[]>();
  for (const p of places) {
    const key = by === "area" ? p.area : p.type;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups].map(([key, list]) => ({
    key,
    count: list.length,
    scheduled: list.filter((p) => scheduled.has(p._id)).length,
    places: list.map((p) => placeView(p, photosOf.get(p._id))),
  }));
}
