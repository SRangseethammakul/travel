import { Router } from "express";
import { requireUser } from "../auth/middleware.js";
import { join, previewJoin } from "../controllers/join.controller.js";

/** Mounted at /api/join. The preview is public; joining needs a signed-in User. */
export const joinRoutes = Router();
joinRoutes.get("/:token", previewJoin);
joinRoutes.post("/:token", requireUser, join);
