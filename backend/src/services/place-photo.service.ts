import { newId } from "../db/ids.js";
import { sniffImageMime } from "../domain/file-type.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { findPlace, findPlaceById, pullPlacePhoto, pushPlacePhoto } from "../models/place.model.js";
import { MAX_PLACE_PHOTOS, type MemberDoc, type PlaceDoc, type PlacePhotoDoc } from "../schemas/models.js";
import { PHOTO_URL_TTL_MS, readStoredFile, removeFiles, saveFile, signedFileUrl, verifyFileSignature } from "../storage/files.js";

const placeNotFound = () => new HttpError(404, "place_not_found", "ไม่พบสถานที่นี้");
const photoNotFound = () => new HttpError(404, "photo_not_found", "ไม่พบรูปนี้");

/** What the signature of a local photo URL covers (it is checked before any database read). */
const subjectOf = (placeId: string, photoId: string) => `place-photo:${placeId}:${photoId}`;

/** A photo with its short-lived URL; the controller turns it into the API JSON. */
export interface SignedPhoto {
  photo: PlacePhotoDoc;
  signed: { url: string; expiresAt: Date };
}

async function signPhoto(placeId: string, photo: PlacePhotoDoc): Promise<SignedPhoto> {
  const signed = await signedFileUrl(
    {
      fileKey: photo.fileKey,
      mime: photo.mime,
      local: { path: `/api/files/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(photo._id)}`, subject: subjectOf(placeId, photo._id) },
    },
    PHOTO_URL_TTL_MS,
  );
  return { photo, signed };
}

/** The signed photos of each Place, keyed by Place id (Places without photos are left out). */
export async function signedPhotosByPlace(places: PlaceDoc[]): Promise<Map<string, SignedPhoto[]>> {
  const entries = await Promise.all(
    places.filter((p) => p.photos?.length).map(async (p) => [p._id, await Promise.all(p.photos!.map((ph) => signPhoto(p._id, ph)))] as const),
  );
  return new Map(entries);
}

/** Owner/editor. The type comes from the bytes. */
export async function upload(me: MemberDoc, placeId: string, file: { buffer: Buffer; size: number } | null): Promise<SignedPhoto> {
  const place = await findPlace(me.tripId, placeId);
  if (!place) throw placeNotFound();
  if (!file) throw new HttpError(400, "file_required", "กรุณาเลือกไฟล์");
  const mime = sniffImageMime(file.buffer);
  if (!mime) throw new HttpError(400, "unsupported_file_type", "รองรับเฉพาะรูปภาพ (JPEG, PNG, HEIC, WebP)");
  const full = () => new HttpError(409, "photo_limit", `แต่ละสถานที่ใส่รูปได้ไม่เกิน ${MAX_PLACE_PHOTOS} รูป`);
  if ((place.photos?.length ?? 0) >= MAX_PLACE_PHOTOS) throw full();

  const _id = newId();
  const photo: PlacePhotoDoc = {
    _id,
    fileKey: `${me.tripId}/places/${placeId}/${_id}`,
    mime,
    size: file.size,
    uploadedBy: me._id,
    createdAt: new Date(),
  };
  await saveFile(photo.fileKey, file.buffer, mime);
  if (!(await pushPlacePhoto(me.tripId, placeId, photo))) {
    await removeFiles([photo.fileKey]); // lost a race: the Place filled up (or was deleted) meanwhile
    throw (await findPlace(me.tripId, placeId)) ? full() : placeNotFound();
  }
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: placeId, text: `เพิ่มรูป "${place.name}"` });
  return signPhoto(placeId, photo);
}

/** The owner, or whoever uploaded it. */
export async function remove(me: MemberDoc, placeId: string, photoId: string): Promise<void> {
  const place = await findPlace(me.tripId, placeId);
  if (!place) throw placeNotFound();
  const photo = place.photos?.find((p) => p._id === photoId);
  if (!photo) throw photoNotFound();
  if (me.role !== "owner" && photo.uploadedBy !== me._id) throw new HttpError(403, "forbidden", "คุณลบได้เฉพาะรูปที่ตัวเองอัปโหลด");
  if (await pullPlacePhoto(me.tripId, placeId, photo._id)) {
    await removeFiles([photo.fileKey]);
    await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: placeId, text: `ลบรูป "${place.name}"` });
  }
}

/** Local driver only; public, but only with a valid unexpired signature (`query` null = malformed). */
export async function serve(placeId: string, photoId: string, query: { exp: number; sig: string } | null): Promise<{ photo: PlacePhotoDoc; bytes: Buffer }> {
  if (!query || !verifyFileSignature(subjectOf(placeId, photoId), query.exp, query.sig)) {
    throw new HttpError(403, "invalid_signature", "ลิงก์หมดอายุหรือไม่ถูกต้อง");
  }
  const photo = (await findPlaceById(placeId))?.photos?.find((p) => p._id === photoId);
  const bytes = photo ? await readStoredFile(photo.fileKey) : null;
  if (!photo || !bytes) throw photoNotFound();
  return { photo, bytes };
}
