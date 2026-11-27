import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { ActivityQuery, ActivityReadBody } from "../schemas/money.js";
import * as activities from "../services/activity.service.js";
import { activityView } from "../views/activity.view.js";

/**
 * A16 — newest first, `?type=expense|settlement|plan|member`, `?before=<createdAt>[&beforeId=<id>]&limit=` paging.
 * Items about a Settlement the viewer still has to confirm carry `action: "confirm_settlement"`.
 */
export const listActivity: RequestHandler = async (req, res) => {
  const items = await activities.list(currentMember(req), ActivityQuery.parse(req.query));
  res.json(items.map((i) => activityView(i.activity, i.needsConfirm)));
};

/** B39 — any Member: mark Activities as read by the current User (`ids` empty = all of the trip). */
export const markRead: RequestHandler = async (req, res) => {
  const { ids } = ActivityReadBody.parse(req.body ?? {});
  await activities.markRead(currentMember(req).tripId, currentUser(req)._id, ids);
  res.status(204).end();
};
