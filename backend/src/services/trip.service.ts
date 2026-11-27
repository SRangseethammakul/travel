import { newId } from "../db/ids.js";
import { PALETTE } from "../domain/colors.js";
import { outstandingOf } from "../domain/money/trip.js";
import { checkLegs } from "../domain/plan.js";
import { todayInBangkok, tripDayCount } from "../domain/trip-dates.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { loadBalanceInputs } from "../models/balance.model.js";
import { insertTemplateItems } from "../models/checklist.model.js";
import { findActiveMembershipsOfUser, insertMembers } from "../models/member.model.js";
import { deleteTripCascade, findTripById, findTripsByIds, insertTrip, updateTrip } from "../models/trip.model.js";
import type { MemberDoc, TripDoc, UserDoc } from "../schemas/models.js";
import type { CreateTripInput, TripListQuery, UpdateTripInput } from "../schemas/trip.inputs.js";
import { removeFiles } from "../storage/files.js";
import type { z } from "zod";
import { setAndUnset } from "./fields.js";

/**
 * startDate ≤ endDate (max 366 days), and City Legs inside the trip, not overlapping, no city twice.
 * Returns the legs sorted by day.
 */
function checkTripDates(t: Pick<TripDoc, "startDate" | "endDate" | "legs">): TripDoc["legs"] {
  const days = tripDayCount(t.startDate, t.endDate);
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new HttpError(400, "invalid_dates", "วันเดินทางไม่ถูกต้อง");
  }
  if (!t.legs) return undefined;
  const checked = checkLegs(t.legs, days);
  if (!checked.ok) throw new HttpError(400, "invalid_legs", checked.error);
  return checked.legs;
}

async function loadTrip(tripId: string): Promise<TripDoc> {
  const trip = await findTripById(tripId);
  if (!trip) throw new HttpError(404, "trip_not_found", "ไม่พบทริปนี้");
  return trip;
}

export interface TripRow {
  trip: TripDoc;
  me: MemberDoc;
  outstanding: number;
}

/** A2 — my trips with my Outstanding, soonest first. */
export async function listMine(user: UserDoc, tab: z.infer<typeof TripListQuery>["tab"]): Promise<TripRow[]> {
  const memberships = await findActiveMembershipsOfUser(user._id);
  const trips = new Map((await findTripsByIds(memberships.map((m) => m.tripId))).map((t) => [t._id, t]));
  const today = todayInBangkok();
  const wanted = memberships.flatMap((me) => {
    const trip = trips.get(me.tripId);
    if (!trip) return [];
    const past = trip.endDate < today;
    if ((tab === "past" && !past) || (tab === "upcoming" && past)) return [];
    return [{ trip, me }];
  });
  const rows = await Promise.all(
    wanted.map(async ({ trip, me }) => ({
      trip,
      me,
      outstanding: outstandingOf(await loadBalanceInputs(trip._id), me._id),
    })),
  );
  rows.sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  return rows;
}

/** B1 — creator becomes owner; other names become Unclaimed Members. */
export async function create(user: UserDoc, input: z.infer<typeof CreateTripInput>): Promise<TripDoc> {
  const legs = checkTripDates(input);
  const now = new Date();
  const tripId = newId();
  const trip: TripDoc = {
    _id: tripId,
    name: input.name,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: input.budget,
    baseCurrency: "THB",
    cover: input.cover,
    ...(legs?.length ? { legs } : {}),
    ...(input.meetingPoint ? { meetingPoint: input.meetingPoint } : {}),
    createdBy: user._id,
    createdAt: now,
    updatedAt: now,
  };
  const owner: MemberDoc = {
    _id: newId(),
    tripId,
    userId: user._id,
    displayName: user.name.slice(0, 50),
    role: "owner",
    status: "active",
    joinedVia: user.provider,
    color: user.color,
    createdAt: now,
  };
  const colors = PALETTE.filter((c) => c !== user.color);
  const others: MemberDoc[] = input.members.map((m, i) => ({
    _id: newId(),
    tripId,
    userId: null,
    displayName: m.displayName,
    role: "editor",
    status: "active",
    color: colors[i % colors.length]!,
    createdAt: now,
  }));
  await insertTrip(trip);
  await insertMembers([owner, ...others]);
  await insertTemplateItems(tripId, { group: true, personalFor: owner._id });
  await addActivity({ tripId, actorId: owner._id, type: "member", refId: tripId, text: `สร้างทริป "${trip.name}"` });
  return trip;
}

/** A3 */
export function get(tripId: string): Promise<TripDoc> {
  return loadTrip(tripId);
}

/** B2 — incl. `legs` and `meetingPoint` (`null` removes them). */
export async function update(me: MemberDoc, patch: z.infer<typeof UpdateTripInput>): Promise<TripDoc> {
  const trip = await loadTrip(me.tripId);
  const legs = checkTripDates({
    startDate: patch.startDate ?? trip.startDate,
    endDate: patch.endDate ?? trip.endDate,
    legs: patch.legs === undefined ? trip.legs : (patch.legs ?? undefined),
  });
  // An empty list removes the route, like `null`.
  const legsPatch = patch.legs === undefined ? undefined : legs?.length ? legs : null;
  const { $set, $unset } = setAndUnset({ ...patch, legs: legsPatch }, ["legs", "meetingPoint"]);
  const updated = await updateTrip(me.tripId, {
    $set: { ...$set, updatedAt: new Date() },
    ...(Object.keys($unset).length ? { $unset } : {}),
  });
  if (!updated) throw new HttpError(404, "trip_not_found", "ไม่พบทริปนี้");
  if (Object.entries(patch).some(([key, value]) => key !== "legs" && value !== undefined)) {
    await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: me.tripId, text: "แก้ไขรายละเอียดทริป" });
  }
  if (legsPatch !== undefined) {
    await addActivity({
      tripId: me.tripId,
      actorId: me._id,
      type: "plan",
      refId: me.tripId,
      text: legsPatch ? `แก้เส้นทางเมือง: ${legsPatch.map((l) => l.city).join(" → ")}` : "ลบเส้นทางเมือง",
    });
  }
  return updated;
}

/** B3 — trip first, then everything in it, then the files. */
export async function remove(tripId: string): Promise<void> {
  const fileKeys = await deleteTripCascade(tripId);
  await removeFiles(fileKeys);
}
