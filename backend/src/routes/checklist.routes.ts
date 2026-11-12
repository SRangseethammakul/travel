import { Router } from "express";
import { requireUser } from "../auth/middleware.js";
import {
  createChecklistItem,
  getChecklist,
  getSuggestions,
  removeChecklistItem,
  updateChecklist,
} from "../controllers/checklist.controller.js";

/**
 * Mounted at /api/trips/:tripId/checklist behind requireUser + requireMember. Roles depend on
 * the item's scope (group vs personal), so they are checked in the controller.
 */
export const checklistRoutes = Router();
checklistRoutes.get("/", getChecklist);
checklistRoutes.post("/", createChecklistItem);
checklistRoutes.patch("/:itemId", updateChecklist);
checklistRoutes.delete("/:itemId", removeChecklistItem);

/** Mounted at /api/checklist. */
export const checklistSuggestionRoutes = Router();
checklistSuggestionRoutes.get("/suggestions", requireUser, getSuggestions);
