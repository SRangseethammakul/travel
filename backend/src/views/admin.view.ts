import type { Paged, TripActivity, TripRow, UserActivity, UserRow } from "../services/admin.service.js";
import { PAGE_SIZE } from "../services/admin.service.js";
import type { MemberDoc, RequestLogDoc, Role } from "../schemas/models.js";

export function adminUserRow({ user, tripCount }: UserRow) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    color: user.color,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    tripCount,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}

export function adminTripRow({ trip, status, owners, memberCount, spent }: TripRow) {
  return {
    id: trip._id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    cover: trip.cover,
    status,
    owners: owners.map((o) => ({ memberId: o._id, name: o.displayName, userId: o.userId })),
    memberCount,
    spent,
  };
}

export const adminPage = <T, V>(page: Paged<T>, view: (item: T) => V) => ({
  items: page.items.map(view),
  page: page.page,
  pageSize: PAGE_SIZE,
  total: page.total,
});

export function adminUserDetail(d: {
  row: UserRow;
  sessionVersion: number;
  trips: (TripRow & { role: Role })[];
  activity: UserActivity[];
}) {
  return {
    user: { ...adminUserRow(d.row), sessionVersion: d.sessionVersion },
    trips: d.trips.map((t) => ({
      id: t.trip._id,
      name: t.trip.name,
      startDate: t.trip.startDate,
      endDate: t.trip.endDate,
      cover: t.trip.cover,
      status: t.status,
      memberCount: t.memberCount,
      role: t.role,
    })),
    activity: d.activity.map(({ activity: a, tripName }) => ({
      id: a._id,
      tripId: a.tripId,
      tripName,
      type: a.type,
      text: a.text,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export function adminTripDetail(d: {
  row: TripRow;
  createdBy: { id: string; name: string } | null;
  members: MemberDoc[];
  counts: Record<string, number>;
  activity: TripActivity[];
}) {
  return {
    trip: { ...adminTripRow(d.row), createdBy: d.createdBy },
    members: d.members.map((m) => ({ id: m._id, displayName: m.displayName, role: m.role, userId: m.userId, color: m.color, status: m.status })),
    counts: d.counts,
    activity: d.activity.map(({ activity: a, actorName }) => ({
      id: a._id,
      actorName,
      type: a.type,
      text: a.text,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export const requestLogView = (l: RequestLogDoc) => ({
  id: l._id,
  at: l.at.toISOString(),
  method: l.method,
  path: l.path,
  status: l.status,
  ms: l.ms,
  userId: l.userId,
});
