import { Router } from "express";
import { devListUsers, devLogin } from "../controllers/dev.controller.js";

/** Mounted at /api/dev outside production only. */
export const devRoutes = Router();
devRoutes.get("/users", devListUsers);
devRoutes.post("/login", devLogin);
