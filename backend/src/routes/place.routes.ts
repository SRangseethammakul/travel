import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { createPlace, getPlace, listPlaces, patchArea, patchPlace, removePlace } from "../controllers/place.controller.js";

const editors = requireRole("owner", "editor");

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

/** Mounted at /api/trips/:tripId/areas (after requireUser, requireMember). Owner only. */
export const areaRoutes = Router();
areaRoutes.patch("/", requireRole("owner"), patchArea);
