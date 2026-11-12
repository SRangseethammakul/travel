import { Router } from "express";
import {
  createTag,
  listMyTags,
  listTripTags,
  myTagUsage,
  patchTag,
  removeTag,
  suggestTags,
} from "../controllers/tag.controller.js";

/** Mounted at /api/trips/:tripId/tags (after requireUser, requireMember). Any Member. */
export const tripTagRoutes = Router();
tripTagRoutes.get("/", listTripTags);
tripTagRoutes.get("/suggest", suggestTags);

/** Mounted at /api/me/tags (after requireUser). Edits are limited to the tag's owner in the controller. */
export const myTagRoutes = Router();
myTagRoutes.get("/", listMyTags);
myTagRoutes.get("/usage", myTagUsage);
myTagRoutes.post("/", createTag);
myTagRoutes.patch("/:tagId", patchTag);
myTagRoutes.delete("/:tagId", removeTag);
