/** Read-only queries across all Users and Trips for the admin dashboard. Never touches personal expenses, personal checklist items or documents. */
import type { Filter, Sort } from "mongodb";
import { collections } from "../db/collections.js";
import { getDb } from "../db/client.js";
import type { ActivityDoc, MemberDoc, TripDoc, UserDoc } from "../schemas/models.js";

export interface DateRange {
  from: Date;
  to: Date;
}

const inRange = ({ from, to }: DateRange) => ({ $gte: from, $lt: to });
const dir = (d: "asc" | "desc") => (d === "asc" ? 1 : -1);

// ---------- users ----------

export async function pageUsers(opts: {
  filter: Filter<UserDoc>;
  sort: "createdAt" | "lastSeenAt" | "name";
  dir: "asc" | "desc";
  skip: number;
  limit: number;
}) {
  const sort: Sort = { [opts.sort]: dir(opts.dir), _id: 1 };
  const [items, total] = await Promise.all([
    collections.users().find(opts.filter).sort(sort).skip(opts.skip).limit(opts.limit).toArray(),
    collections.users().countDocuments(opts.filter),
  ]);
  return { items, total };
}

export function newestUsers(limit: number): Promise<UserDoc[]> {
  return collections.users().find().sort({ createdAt: -1, _id: 1 }).limit(limit).toArray();
}

export function findUserIdsByName(re: RegExp): Promise<string[]> {
  return collections.users().distinct("_id", { name: re });
}

/** userId → number of active memberships. */
export async function activeTripCounts(userIds: string[]): Promise<Map<string, number>> {
  const rows = await collections
    .members()
    .aggregate<{ _id: string; c: number }>([
      { $match: { userId: { $in: userIds }, status: "active" } },
      { $group: { _id: "$userId", c: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.c]));
}

export function activeMembershipsOfUser(userId: string): Promise<MemberDoc[]> {
  return collections.members().find({ userId, status: "active" }).toArray();
}

export function memberIdsOfUser(userId: string): Promise<string[]> {
  return collections.members().distinct("_id", { userId });
}

export function activitiesByActors(actorIds: string[], limit: number): Promise<ActivityDoc[]> {
  return collections.activities().find({ actorId: { $in: actorIds } }).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
}

// ---------- trips ----------

/** Trips that have an active owner Member whose displayName or linked User name matches. */
export async function tripIdsByOwnerName(re: RegExp, userIds: string[]): Promise<string[]> {
  return collections.members().distinct("tripId", {
    role: "owner",
    status: "active",
    $or: [{ displayName: re }, ...(userIds.length ? [{ userId: { $in: userIds } }] : [])],
  });
}

export async function pageTrips(opts: {
  filter: Filter<TripDoc>;
  sort: "startDate" | "createdAt";
  dir: "asc" | "desc";
  skip: number;
  limit: number;
}) {
  const sort: Sort = { [opts.sort]: dir(opts.dir), _id: 1 };
  const [items, total] = await Promise.all([
    collections.trips().find(opts.filter).sort(sort).skip(opts.skip).limit(opts.limit).toArray(),
    collections.trips().countDocuments(opts.filter),
  ]);
  return { items, total };
}

export function activeOwners(tripIds: string[]): Promise<MemberDoc[]> {
  return collections.members().find({ tripId: { $in: tripIds }, role: "owner", status: "active" }).sort({ createdAt: 1, _id: 1 }).toArray();
}

export async function activeMemberCounts(tripIds: string[]): Promise<Map<string, number>> {
  const rows = await collections
    .members()
    .aggregate<{ _id: string; c: number }>([
      { $match: { tripId: { $in: tripIds }, status: "active" } },
      { $group: { _id: "$tripId", c: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.c]));
}

/** tripId → sum of group Expense amounts (satang). Personal expenses live in another collection and are not read. */
export async function spentByTrip(tripIds: string[]): Promise<Map<string, number>> {
  const rows = await collections
    .expenses()
    .aggregate<{ _id: string; total: number }>([
      { $match: { tripId: { $in: tripIds } } },
      { $group: { _id: "$tripId", total: { $sum: "$amount" } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.total]));
}

export async function tripDetailCounts(tripId: string) {
  const [places, planItems, expenses, settlements, checklistItems] = await Promise.all([
    collections.places().countDocuments({ tripId }),
    collections.planItems().countDocuments({ tripId }),
    collections.expenses().countDocuments({ tripId }),
    collections.settlements().countDocuments({ tripId }),
    collections.checklistItems().countDocuments({ tripId, scope: "group" }),
  ]);
  return { places, planItems, expenses, settlements, checklistItems };
}

export function listTripActivities(tripId: string, limit: number): Promise<ActivityDoc[]> {
  return collections.activities().find({ tripId }).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
}

export function findMembersByIds(ids: string[]): Promise<MemberDoc[]> {
  return collections.members().find({ _id: { $in: ids } }).toArray();
}

export function findUsersByIds(ids: string[]): Promise<UserDoc[]> {
  return collections.users().find({ _id: { $in: ids } }).toArray();
}

// ---------- overview ----------

export const countUsers = (): Promise<number> => collections.users().countDocuments();
export const countTrips = (): Promise<number> => collections.trips().countDocuments();
export const countUsersCreated = (r: DateRange): Promise<number> => collections.users().countDocuments({ createdAt: inRange(r) });
export const countTripsCreated = (r: DateRange): Promise<number> => collections.trips().countDocuments({ createdAt: inRange(r) });
export const countActiveMembers = (): Promise<number> => collections.members().countDocuments({ status: "active" });

/** Distinct trips with at least one Activity in the range. */
export async function countActiveTrips(r: DateRange): Promise<number> {
  return (await collections.activities().distinct("tripId", { createdAt: inRange(r) })).length;
}

/** Distinct Users that are an active Member of at least one Trip. */
export async function countUsersInTrips(): Promise<number> {
  return (await collections.members().distinct("userId", { status: "active", userId: { $type: "string" } })).length;
}

/** "YYYY-MM-DD" (Bangkok) → number of documents created that day. */
export async function dailyCreated(name: "users" | "trips", r: DateRange): Promise<Map<string, number>> {
  const rows = await getDb()
    .collection(name)
    .aggregate<{ _id: string; c: number }>([
      { $match: { createdAt: inRange(r) } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Bangkok" } }, c: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((x) => [x._id, x.c]));
}

export async function providerCounts(): Promise<Map<string, number>> {
  const rows = await collections
    .users()
    .aggregate<{ _id: string; c: number }>([{ $group: { _id: "$provider", c: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.c]));
}

/** Trips with the most Activities since `from`, busiest first. */
export function busiestTrips(from: Date, limit: number): Promise<{ _id: string; c: number }[]> {
  return collections
    .activities()
    .aggregate<{ _id: string; c: number }>([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: "$tripId", c: { $sum: 1 } } },
      { $sort: { c: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();
}

export function countTripActivitiesSince(tripId: string, from: Date): Promise<number> {
  return collections.activities().countDocuments({ tripId, createdAt: { $gte: from } });
}

export async function activityCountsSince(tripIds: string[], from: Date): Promise<Map<string, number>> {
  const rows = await collections
    .activities()
    .aggregate<{ _id: string; c: number }>([
      { $match: { tripId: { $in: tripIds }, createdAt: { $gte: from } } },
      { $group: { _id: "$tripId", c: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.c]));
}

// ---------- system ----------

/** Pings MongoDB; `ok: false` instead of throwing when it does not answer. */
export async function mongoStatus(): Promise<{ ok: boolean; pingMs: number | null; collections: number }> {
  try {
    const t0 = process.hrtime.bigint();
    await getDb().command({ ping: 1 });
    const pingMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
    const names = await getDb().listCollections({}, { nameOnly: true }).toArray();
    return { ok: true, pingMs, collections: names.length };
  } catch {
    return { ok: false, pingMs: null, collections: 0 };
  }
}
