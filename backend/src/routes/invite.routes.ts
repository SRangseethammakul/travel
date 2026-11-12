import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { getInvite, resetInvite, setInvite } from "../controllers/invite.controller.js";

/** Mounted at /api/trips/:tripId/invite behind requireUser + requireMember. Owner only. */
export const inviteRoutes = Router();
inviteRoutes.use(requireRole("owner"));
inviteRoutes.get("/", getInvite);
inviteRoutes.put("/", setInvite);
inviteRoutes.post("/reset", resetInvite);
