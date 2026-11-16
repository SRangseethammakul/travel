import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { removePlacePhoto, uploadPlacePhoto } from "../controllers/place-photo.controller.js";
import { createPlace, getPlace, listPlaces, patchArea, patchPlace, removePlace } from "../controllers/place.controller.js";

import { userLimiter } from "./rate-limit.js";
import { singleFile } from "./upload.js";

const editors = requireRole("owner", "editor");
/** Per User (not IP): this router is mounted behind `requireUser` in app.ts — keep it that way. */
const uploadLimiter = userLimiter();

/**
 * Mounted at /api/trips/:tripId/places (after requireUser, requireMember). Adding is editor+;
 * editing/deleting is owner, or the editor who added the Place (checked in the controller).
 */
export const placeRoutes = Router();
placeRoutes.get("/", listPlaces);
placeRoutes.post("/", editors, createPlace);
placeRoutes.get("/:placeId", getPlace);
placeRoutes.patch("/:placeId", editors, patchPlace);
placeRoutes.delete("/:placeId", editors, removePlace);
// Photos: upload is editor+; delete is owner or the uploader (checked in the controller).
placeRoutes.post("/:placeId/photos", editors, uploadLimiter, singleFile, uploadPlacePhoto);
placeRoutes.delete("/:placeId/photos/:photoId", removePlacePhoto);

/** Mounted at /api/trips/:tripId/areas (after requireUser, requireMember). Owner only. */
export const areaRoutes = Router();
areaRoutes.patch("/", requireRole("owner"), patchArea);
