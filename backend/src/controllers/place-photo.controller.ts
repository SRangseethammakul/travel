import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { newId } from "../db/ids.js";
import { sniffImageMime } from "../domain/file-type.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { findPlace, findPlaceById, pullPlacePhoto, pushPlacePhoto } from "../models/place.model.js";
import { SignedFileQuery } from "../schemas/document.inputs.js";
import { MAX_PLACE_PHOTOS, type PlaceDoc, type PlacePhotoDoc } from "../schemas/models.js";
import { PHOTO_URL_TTL_MS, readStoredFile, removeFiles, saveFile, signedFileUrl, verifyFileSignature } from "../storage/files.js";
import { placePhotoView, placeView, type PlacePhotoView } from "../views/place.view.js";
import { param } from "./params.js";

const placeNotFound = () => new HttpError(404, "place_not_found", "ไม่พบสถานที่นี้");
const photoNotFound = () => new HttpError(404, "photo_not_found", "ไม่พบรูปนี้");

/** What the signature of a local photo URL covers (it is checked before any database read). */
const subjectOf = (placeId: string, photoId: string) => `place-photo:${placeId}:${photoId}`;

async function signPhoto(placeId: string, photo: PlacePhotoDoc): Promise<PlacePhotoView> {
  const signed = await signedFileUrl(
    {
      fileKey: photo.fileKey,
      mime: photo.mime,
      local: { path: `/api/files/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(photo._id)}`, subject: subjectOf(placeId, photo._id) },
    },
    PHOTO_URL_TTL_MS,
  );
  return placePhotoView(photo, signed);
}

/** The signed photos of each Place, keyed by Place id (Places without photos are left out). */
export async function signedPhotosByPlace(places: PlaceDoc[]): Promise<Map<string, PlacePhotoView[]>> {
  const entries = await Promise.all(
    places.filter((p) => p.photos?.length).map(async (p) => [p._id, await Promise.all(p.photos!.map((ph) => signPhoto(p._id, ph)))] as const),
  );
  return new Map(entries);
}

/** The Place as the API returns it, with signed photo URLs. */
export async function placeWithPhotos(place: PlaceDoc) {
  return placeView(place, (await signedPhotosByPlace([place])).get(place._id));
}

/** POST /api/trips/:tripId/places/:placeId/photos (multipart `file`) — owner/editor. Type comes from the bytes. */
export const uploadPlacePhoto: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const placeId = param(req, "placeId");
  const place = await findPlace(me.tripId, placeId);
  if (!place) throw placeNotFound();
  const file = req.file;
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
  res.status(201).json(await signPhoto(placeId, photo));
};

/** DELETE /api/trips/:tripId/places/:placeId/photos/:photoId — the owner, or whoever uploaded it. */
export const removePlacePhoto: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const placeId = param(req, "placeId");
  const place = await findPlace(me.tripId, placeId);
  if (!place) throw placeNotFound();
  const photo = place.photos?.find((p) => p._id === param(req, "photoId"));
  if (!photo) throw photoNotFound();
  if (me.role !== "owner" && photo.uploadedBy !== me._id) throw new HttpError(403, "forbidden", "คุณลบได้เฉพาะรูปที่ตัวเองอัปโหลด");
  if (await pullPlacePhoto(me.tripId, placeId, photo._id)) {
    await removeFiles([photo.fileKey]);
    await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: placeId, text: `ลบรูป "${place.name}"` });
  }
  res.status(204).end();
};

/** GET /api/files/places/:placeId/photos/:photoId?exp&sig — local driver only; public, but only with a valid unexpired signature. */
export const servePlacePhoto: RequestHandler = async (req, res) => {
  const placeId = param(req, "placeId");
  const photoId = param(req, "photoId");
  const query = SignedFileQuery.safeParse(req.query);
  if (!query.success || !verifyFileSignature(subjectOf(placeId, photoId), query.data.exp, query.data.sig)) {
    throw new HttpError(403, "invalid_signature", "ลิงก์หมดอายุหรือไม่ถูกต้อง");
  }
  const photo = (await findPlaceById(placeId))?.photos?.find((p) => p._id === photoId);
  const bytes = photo ? await readStoredFile(photo.fileKey) : null;
  if (!photo || !bytes) throw photoNotFound();
  res.set({ "Content-Type": photo.mime, "Cache-Control": "private, no-store" });
  res.send(bytes);
};
