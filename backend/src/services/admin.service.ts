import type { Filter } from "mongodb";
import { HttpError } from "../errors.js";
import { hourStart, lastBangkokDays, last24Hours, p95, rollingWindows, tripStatus, type TripStatus } from "../domain/admin-stats.js";
import { todayInBangkok } from "../domain/trip-dates.js";
import * as admin from "../models/admin.model.js";
import { findTripById, findTripsByIds } from "../models/trip.model.js";
import { bumpSessionVersion, findUserById } from "../models/user.model.js";
import { listTripMembers } from "../models/member.model.js";
import { pageRequestLogs, requestLogsSince } from "../models/request-log.model.js";
import type { AdminSystemQuery, AdminTripsQuery, AdminUsersQuery } from "../schemas/admin.inputs.js";
import type { ActivityDoc, MemberDoc, RequestLogDoc, Role, TripDoc, UserDoc } from "../schemas/models.js";
import { containsRegex } from "../utils/regex.js";
import { logger } from "../utils/logger.js";

export const PAGE_SIZE = 20;
const DAY_MS = 86_400_000;
const SLOW_MS = 500;
const notFound = () => new HttpError(404, "not_found", "ไม่พบสิ่งที่ต้องการ");

export interface Paged<T> {
  items: T[];
  page: number;
  total: number;
}

export interface UserRow {
  user: UserDoc;
  tripCount: number;
}

export interface TripRow {
  trip: TripDoc;
  status: TripStatus;
  owners: MemberDoc[];
  memberCount: number;
  spent: number;
}

async function userRows(users: UserDoc[]): Promise<UserRow[]> {
  const counts = await admin.activeTripCounts(users.map((u) => u._id));
  return users.map((user) => ({ user, tripCount: counts.get(user._id) ?? 0 }));
}

async function tripRows(trips: TripDoc[], now: Date): Promise<TripRow[]> {
  const ids = trips.map((t) => t._id);
  const [owners, memberCounts, spent] = await Promise.all([admin.activeOwners(ids), admin.activeMemberCounts(ids), admin.spentByTrip(ids)]);
  const today = todayInBangkok(now);
  return trips.map((trip) => ({
    trip,
    status: tripStatus(trip, today),
    owners: owners.filter((o) => o.tripId === trip._id),
    memberCount: memberCounts.get(trip._id) ?? 0,
    spent: spent.get(trip._id) ?? 0,
  }));
}

// ---------- overview ----------

export async function overview(days: 7 | 30 | 90, now: Date = new Date()) {
  const window = lastBangkokDays(now, days);
  const week = lastBangkokDays(now, 7);
  const activity = rollingWindows(now, 7);
  const [totalUsers, totalTrips, usersNew, tripsNew, signups, activeNow, activePrev, userDaily, tripDaily, providers, usersInTrips, activeMembers, recent, busiest] =
    await Promise.all([
      admin.countUsers(),
      admin.countTrips(),
      Promise.all([admin.countUsersCreated(window.current), admin.countUsersCreated(window.previous)]),
      Promise.all([admin.countTripsCreated(window.current), admin.countTripsCreated(window.previous)]),
      Promise.all([admin.countUsersCreated(week.current), admin.countUsersCreated(week.previous)]),
      admin.countActiveTrips(activity.current),
      admin.countActiveTrips(activity.previous),
      admin.dailyCreated("users", window.current),
      admin.dailyCreated("trips", window.current),
      admin.providerCounts(),
      admin.countUsersInTrips(),
      admin.countActiveMembers(),
      admin.newestUsers(5),
      admin.busiestTrips(activity.current.from, 5),
    ]);
  const busiestTrips = await findTripsByIds(busiest.map((b) => b._id));
  const rows = await tripRows(busiestTrips, now);
  return {
    totals: { users: totalUsers, trips: totalTrips },
    kpis: {
      usersNew: { current: usersNew[0], previous: usersNew[1] },
      tripsNew: { current: tripsNew[0], previous: tripsNew[1] },
      activeTrips7d: { current: activeNow, previous: activePrev },
      signups7d: { current: signups[0], previous: signups[1] },
    },
    daily: window.dates.map((date) => ({ date, users: userDaily.get(date) ?? 0, trips: tripDaily.get(date) ?? 0 })),
    providers: { google: providers.get("google") ?? 0, line: providers.get("line") ?? 0 },
    usersInTripPct: totalUsers === 0 ? 0 : Math.round((usersInTrips / totalUsers) * 100),
    avgMembersPerTrip: totalTrips === 0 ? 0 : Math.round((activeMembers / totalTrips) * 10) / 10,
    recentUsers: await userRows(recent),
    busiestTrips: busiest.flatMap((b) => {
      const row = rows.find((r) => r.trip._id === b._id);
      return row ? [{ ...row, activity7d: b.c }] : [];
    }),
  };
}

// ---------- users ----------

export async function listUsers(query: AdminUsersQuery): Promise<Paged<UserRow>> {
  const filter: Filter<UserDoc> = {};
  if (query.provider) filter.provider = query.provider;
  if (query.q) {
    const re = containsRegex(query.q);
    filter.$or = [{ name: re }, { email: re }];
  }
  const { items, total } = await admin.pageUsers({ filter, sort: query.sort, dir: query.dir, skip: (query.page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
  return { items: await userRows(items), page: query.page, total };
}

export interface UserActivity {
  activity: ActivityDoc;
  tripName: string;
}

export async function userDetail(userId: string, now: Date = new Date()) {
  const user = await findUserById(userId);
  if (!user) throw notFound();
  const [memberships, memberIds] = await Promise.all([admin.activeMembershipsOfUser(userId), admin.memberIdsOfUser(userId)]);
  const activities = memberIds.length ? await admin.activitiesByActors(memberIds, 10) : [];
  const tripIds = [...new Set([...memberships.map((m) => m.tripId), ...activities.map((a) => a.tripId)])];
  const trips = await findTripsByIds(tripIds);
  const memberTrips = await tripRows(
    trips.filter((t) => memberships.some((m) => m.tripId === t._id)),
    now,
  );
  const roleOf = new Map<string, Role>(memberships.map((m) => [m.tripId, m.role]));
  return {
    row: { user, tripCount: memberships.length } satisfies UserRow,
    trips: memberTrips
      .map((r) => ({ ...r, role: roleOf.get(r.trip._id)! }))
      .sort((a, b) => b.trip.startDate.localeCompare(a.trip.startDate) || a.trip._id.localeCompare(b.trip._id)),
    activity: activities.map((activity) => ({ activity, tripName: trips.find((t) => t._id === activity.tripId)?.name ?? "" })),
  };
}

/** Ends every session of the User (same bump as logout). Admins may do this to each other, not to themselves. */
export async function forceSignOut(adminUser: UserDoc, targetUserId: string): Promise<void> {
  if (targetUserId === adminUser._id) {
    throw new HttpError(409, "cannot_sign_out_self", "ไม่สามารถบังคับออกจากระบบของตัวเองได้");
  }
  if (!(await findUserById(targetUserId))) throw notFound();
  await bumpSessionVersion(targetUserId);
  logger.warn("admin_force_signout", { adminId: adminUser._id, targetUserId });
}

// ---------- trips ----------

export async function listTrips(query: AdminTripsQuery, now: Date = new Date()): Promise<Paged<TripRow>> {
  const today = todayInBangkok(now);
  const and: Filter<TripDoc>[] = [];
  if (query.status === "upcoming") and.push({ startDate: { $gt: today } });
  if (query.status === "ongoing") and.push({ startDate: { $lte: today }, endDate: { $gte: today } });
  if (query.status === "past") and.push({ endDate: { $lt: today } });
  if (query.q) {
    const re = containsRegex(query.q);
    const ownerTripIds = await admin.tripIdsByOwnerName(re, await admin.findUserIdsByName(re));
    and.push({ $or: [{ name: re }, { destination: re }, { _id: { $in: ownerTripIds } }] });
  }
  const { items, total } = await admin.pageTrips({
    filter: and.length ? { $and: and } : {},
    sort: query.sort,
    dir: query.dir,
    skip: (query.page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  return { items: await tripRows(items, now), page: query.page, total };
}

export interface TripActivity {
  activity: ActivityDoc;
  actorName: string;
}

export async function tripDetail(tripId: string, now: Date = new Date()) {
  const trip = await findTripById(tripId);
  if (!trip) throw notFound();
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [[row], members, counts, activity7d, activities, creator] = await Promise.all([
    tripRows([trip], now),
    listTripMembers(tripId),
    admin.tripDetailCounts(tripId),
    admin.countTripActivitiesSince(tripId, since),
    admin.listTripActivities(tripId, 5),
    findUserById(trip.createdBy),
  ]);
  const names = new Map(members.map((m) => [m._id, m.displayName]));
  const missing = activities.map((a) => a.actorId).filter((id) => !names.has(id));
  for (const m of missing.length ? await admin.findMembersByIds(missing) : []) names.set(m._id, m.displayName);
  return {
    row: row!,
    createdBy: creator ? { id: creator._id, name: creator.name } : null,
    members,
    counts: { ...counts, activity7d },
    activity: activities.map((activity) => ({ activity, actorName: names.get(activity.actorId) ?? "ไม่ทราบชื่อ" })),
  };
}

// ---------- system ----------

export async function system(query: AdminSystemQuery, storageDriver: "local" | "s3", now: Date = new Date()) {
  const mongo = await admin.mongoStatus();
  const hours = last24Hours(now);
  const base = {
    api: { uptimeSec: Math.floor(process.uptime()), p95Ms1h: null as number | null },
    mongo,
    storage: { driver: storageDriver },
    rateLimit: { blocked24h: 0 },
    errorsByHour: hours.map((h) => ({ hour: h, c4xx: 0, c5xx: 0, total: 0 })),
    logs: { items: [] as RequestLogDoc[], page: query.page, total: 0 },
  };
  if (!mongo.ok) return base;

  const filter: Record<string, unknown> =
    query.filter === "4xx" ? { status: { $gte: 400, $lt: 500 } } : query.filter === "5xx" ? { status: { $gte: 500 } } : query.filter === "slow" ? { ms: { $gte: SLOW_MS } } : {};
  const dayAgo = now.getTime() - DAY_MS;
  // The oldest hourly bucket starts after now - 24h, so read from whichever is earlier.
  const since = new Date(Math.min(hours[0]!.getTime(), dayAgo));
  const [recent, logs] = await Promise.all([
    requestLogsSince(since, { at: 1, status: 1, ms: 1 }),
    pageRequestLogs(filter, (query.page - 1) * PAGE_SIZE, PAGE_SIZE),
  ]);
  const hourAgo = now.getTime() - 3_600_000;
  for (const r of recent) {
    if (!r.at || r.status === undefined) continue;
    const bucket = base.errorsByHour.find((b) => b.hour.getTime() === hourStart(r.at!).getTime());
    if (bucket) bucket.total += 1;
    if (bucket && r.status >= 500) bucket.c5xx += 1;
    else if (bucket && r.status >= 400) bucket.c4xx += 1;
    if (r.status === 429 && r.at.getTime() >= dayAgo) base.rateLimit.blocked24h += 1;
  }
  base.api.p95Ms1h = p95(recent.filter((r) => r.at && r.at.getTime() >= hourAgo && r.ms !== undefined).map((r) => r.ms!));
  base.logs = { items: logs.items, page: query.page, total: logs.total };
  return base;
}
