import { Router } from "express";
import { requireUser } from "../auth/middleware.js";
import { getMe } from "../controllers/me.controller.js";

export const meRoutes = Router();
meRoutes.get("/", requireUser, getMe);
