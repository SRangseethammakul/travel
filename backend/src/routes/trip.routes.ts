import { Router } from "express";
import { requireMember, requireRole, requireUser } from "../auth/middleware.js";
import { createTrip, deleteTrip, getTrip, listMyTrips, updateTripDetails } from "../controllers/trip.controller.js";

/** Mounted at /api/trips. Trip sub-resources are mounted in app.ts at /api/trips/:tripId/<resource>. */
export const tripRoutes = Router();
tripRoutes.get("/", requireUser, listMyTrips);
tripRoutes.post("/", requireUser, createTrip);
tripRoutes.get("/:tripId", requireUser, requireMember, getTrip);
tripRoutes.patch("/:tripId", requireUser, requireMember, requireRole("owner"), updateTripDetails);
tripRoutes.delete("/:tripId", requireUser, requireMember, requireRole("owner"), deleteTrip);
