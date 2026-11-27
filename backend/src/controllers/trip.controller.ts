import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { CreateTripInput, TripListQuery, UpdateTripInput } from "../schemas/trip.inputs.js";
import * as trips from "../services/trip.service.js";
import { memberView } from "../views/member.view.js";
import { tripView } from "../views/trip.view.js";

/** A2 GET /api/trips?tab=upcoming|past — my trips with my Outstanding, soonest first. */
export const listMyTrips: RequestHandler = async (req, res) => {
  const { tab } = TripListQuery.parse(req.query);
  const rows = await trips.listMine(currentUser(req), tab);
  res.json(rows.map((r) => ({ trip: tripView(r.trip), me: memberView(r.me), outstanding: r.outstanding })));
};

/** B1 POST /api/trips — creator becomes owner; other names become Unclaimed Members. */
export const createTrip: RequestHandler = async (req, res) => {
  const trip = await trips.create(currentUser(req), CreateTripInput.parse(req.body));
  res.status(201).json(tripView(trip));
};

/** A3 GET /api/trips/:tripId -> { trip, me } */
export const getTrip: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  res.json({ trip: tripView(await trips.get(me.tripId)), me: memberView(me) });
};

/** B2 PATCH /api/trips/:tripId (owner) — incl. `legs` and `meetingPoint` (`null` removes them). */
export const updateTripDetails: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  res.json(tripView(await trips.update(me, UpdateTripInput.parse(req.body))));
};

/** B3 DELETE /api/trips/:tripId (owner). */
export const deleteTrip: RequestHandler = async (req, res) => {
  await trips.remove(currentMember(req).tripId);
  res.status(204).end();
};
