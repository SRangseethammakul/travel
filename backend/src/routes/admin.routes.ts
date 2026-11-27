import { Router } from "express";
import type { Config } from "../config/config.js";
import { getOverview, getSystem, getTrip, getUser, listTrips, listUsers, signOutUser, whoami } from "../controllers/admin.controller.js";

/** Mounted at /api/admin behind `requireUser, requireAdmin`. */
export function adminRoutes(config: Pick<Config, "STORAGE_DRIVER">): Router {
  const r = Router();
  r.get("/whoami", whoami);
  r.get("/overview", getOverview);
  r.get("/users", listUsers);
  r.get("/users/:id", getUser);
  r.post("/users/:id/signout", signOutUser);
  r.get("/trips", listTrips);
  r.get("/trips/:id", getTrip);
  r.get("/system", getSystem(config.STORAGE_DRIVER));
  return r;
}
