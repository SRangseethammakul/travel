import type { RequestHandler } from "express";
import { currentUser } from "../auth/middleware.js";
import { AdminOverviewQuery, AdminSystemQuery, AdminTripsQuery, AdminUsersQuery } from "../schemas/admin.inputs.js";
import * as admin from "../services/admin.service.js";
import { adminPage, adminTripDetail, adminTripRow, adminUserDetail, adminUserRow, requestLogView } from "../views/admin.view.js";
import { userView } from "../views/user.view.js";
import { param } from "./params.js";

/** GET /api/admin/whoami */
export const whoami: RequestHandler = (req, res) => {
  res.json({ user: userView(currentUser(req)) });
};

/** GET /api/admin/overview */
export const getOverview: RequestHandler = async (req, res) => {
  const { days } = AdminOverviewQuery.parse(req.query);
  const o = await admin.overview(days);
  res.json({
    ...o,
    recentUsers: o.recentUsers.map(adminUserRow),
    busiestTrips: o.busiestTrips.map((t) => ({ ...adminTripRow(t), activity7d: t.activity7d })),
  });
};

/** GET /api/admin/users */
export const listUsers: RequestHandler = async (req, res) => {
  res.json(adminPage(await admin.listUsers(AdminUsersQuery.parse(req.query)), adminUserRow));
};

/** GET /api/admin/users/:id */
export const getUser: RequestHandler = async (req, res) => {
  const d = await admin.userDetail(param(req, "id"));
  res.json(adminUserDetail({ ...d, sessionVersion: d.row.user.sessionVersion ?? 0 }));
};

/** POST /api/admin/users/:id/signout */
export const signOutUser: RequestHandler = async (req, res) => {
  await admin.forceSignOut(currentUser(req), param(req, "id"));
  res.status(204).end();
};

/** GET /api/admin/trips */
export const listTrips: RequestHandler = async (req, res) => {
  res.json(adminPage(await admin.listTrips(AdminTripsQuery.parse(req.query)), adminTripRow));
};

/** GET /api/admin/trips/:id */
export const getTrip: RequestHandler = async (req, res) => {
  res.json(adminTripDetail(await admin.tripDetail(param(req, "id"))));
};

/** GET /api/admin/system */
export function getSystem(storageDriver: "local" | "s3"): RequestHandler {
  return async (req, res) => {
    const s = await admin.system(AdminSystemQuery.parse(req.query), storageDriver);
    res.json({
      ...s,
      errorsByHour: s.errorsByHour.map((b) => ({ hour: b.hour.toISOString(), c4xx: b.c4xx, c5xx: b.c5xx, total: b.total })),
      logs: adminPage(s.logs, requestLogView),
    });
  };
}
