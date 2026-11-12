import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { listActivities, markActivitiesRead } from "../models/activity.model.js";
import { sentToMember } from "../models/settlement.model.js";
import { ActivityQuery, ActivityReadBody } from "../schemas/money.js";
import { activityView } from "../views/activity.view.js";

/**
 * A16 — newest first, `?type=expense|settlement|plan|member`, `?before=<createdAt>[&beforeId=<id>]&limit=` paging.
 * Items about a Settlement the viewer still has to confirm carry `action: "confirm_settlement"`.
 */
export const listActivity: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const q = ActivityQuery.parse(req.query);
  const items = await listActivities(me.tripId, { type: q.type, before: q.before ? new Date(q.before) : undefined, beforeId: q.beforeId, limit: q.limit });
  const settlementIds = items.filter((a) => a.type === "settlement" && a.refId).map((a) => a.refId!);
  const toConfirm = await sentToMember(me.tripId, me._id, settlementIds);
  res.json(items.map((a) => activityView(a, a.type === "settlement" && !!a.refId && toConfirm.has(a.refId))));
};

/** B39 — any Member: mark Activities as read by the current User (`ids` empty = all of the trip). */
export const markRead: RequestHandler = async (req, res) => {
  const { ids } = ActivityReadBody.parse(req.body ?? {});
  await markActivitiesRead(currentMember(req).tripId, currentUser(req)._id, ids);
  res.status(204).end();
};
