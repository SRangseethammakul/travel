import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import {
  addTransit,
  addVisits,
  deleteHop,
  listPlan,
  patchPlanItem,
  putHop,
  removePlanItem,
} from "../controllers/plan.controller.js";

const editors = requireRole("owner", "editor");

/**
 * Mounted at /api/trips/:tripId/plan (after requireUser, requireMember). Adding is editor+;
 * editing/deleting an item (and its Hop) is owner, or the editor who added it (checked in the controller).
 */
export const planRoutes = Router();
planRoutes.get("/", listPlan);
planRoutes.post("/places", editors, addVisits);
planRoutes.post("/transits", editors, addTransit);
planRoutes.patch("/:itemId", editors, patchPlanItem);
planRoutes.delete("/:itemId", editors, removePlanItem);
planRoutes.put("/:itemId/hop", editors, putHop);
planRoutes.delete("/:itemId/hop", editors, deleteHop);
