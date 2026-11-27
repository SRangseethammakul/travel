import { listActivities, markActivitiesRead } from "../models/activity.model.js";
import { sentToMember } from "../models/settlement.model.js";
import type { ActivityQuery } from "../schemas/money.js";
import type { ActivityDoc, MemberDoc } from "../schemas/models.js";
import type { z } from "zod";

export interface ActivityItem {
  activity: ActivityDoc;
  needsConfirm: boolean;
}

/** A16 — items about a Settlement the viewer still has to confirm are flagged `needsConfirm`. */
export async function list(me: MemberDoc, q: z.infer<typeof ActivityQuery>): Promise<ActivityItem[]> {
  const items = await listActivities(me.tripId, { type: q.type, before: q.before ? new Date(q.before) : undefined, beforeId: q.beforeId, limit: q.limit });
  const settlementIds = items.filter((a) => a.type === "settlement" && a.refId).map((a) => a.refId!);
  const toConfirm = await sentToMember(me.tripId, me._id, settlementIds);
  return items.map((a) => ({ activity: a, needsConfirm: a.type === "settlement" && !!a.refId && toConfirm.has(a.refId) }));
}

/** B39 — mark Activities as read by this User (`ids` empty = all of the trip). */
export async function markRead(tripId: string, userId: string, ids: string[]): Promise<void> {
  await markActivitiesRead(tripId, userId, ids);
}
