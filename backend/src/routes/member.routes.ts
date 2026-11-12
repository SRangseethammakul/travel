import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { addMember, approve, changeRole, listMembers, removeMember } from "../controllers/member.controller.js";

/** Mounted at /api/trips/:tripId/members behind requireUser + requireMember. */
export const memberRoutes = Router();
memberRoutes.get("/", listMembers);
memberRoutes.post("/", requireRole("owner"), addMember);
memberRoutes.patch("/:memberId", requireRole("owner"), changeRole);
memberRoutes.delete("/:memberId", requireRole("owner"), removeMember);
memberRoutes.post("/:memberId/approve", requireRole("owner"), approve);
