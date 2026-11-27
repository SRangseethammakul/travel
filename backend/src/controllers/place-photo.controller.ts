import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { SignedFileQuery } from "../schemas/document.inputs.js";
import * as photos from "../services/place-photo.service.js";
import { placePhotoView } from "../views/place.view.js";
import { param } from "./params.js";

/** POST /api/trips/:tripId/places/:placeId/photos (multipart `file`) — owner/editor. Type comes from the bytes. */
export const uploadPlacePhoto: RequestHandler = async (req, res) => {
  const { photo, signed } = await photos.upload(currentMember(req), param(req, "placeId"), req.file ?? null);
  res.status(201).json(placePhotoView(photo, signed));
};

/** DELETE /api/trips/:tripId/places/:placeId/photos/:photoId — the owner, or whoever uploaded it. */
export const removePlacePhoto: RequestHandler = async (req, res) => {
  await photos.remove(currentMember(req), param(req, "placeId"), param(req, "photoId"));
  res.status(204).end();
};

/** GET /api/files/places/:placeId/photos/:photoId?exp&sig — local driver only; public, but only with a valid unexpired signature. */
export const servePlacePhoto: RequestHandler = async (req, res) => {
  const placeId = param(req, "placeId");
  const photoId = param(req, "photoId");
  const query = SignedFileQuery.safeParse(req.query);
  const { photo, bytes } = await photos.serve(placeId, photoId, query.success ? query.data : null);
  res.set({ "Content-Type": photo.mime, "Cache-Control": "private, no-store" });
  res.send(bytes);
};
