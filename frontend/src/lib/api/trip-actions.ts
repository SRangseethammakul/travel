"use server";

import { revalidatePath } from "next/cache";
import { checkTripDetails, checkTripDraft, TRIP_COVERS, type TripDetails, type TripDraft } from "@/lib/trip-form";
import { actionError, apiFetch, tripPath } from "./http";
import { getCurrentUser } from "./session";
import type { Invite, Trip } from "./types";

export type CreateTripResult = { error: string } | { tripId: string; href: string };

/**
 * CreateTrip: B1 (trip + owner + Unclaimed Members), then B7 so the trip has an
 * invite link right away (7 days, approval on — B1 does not create one).
 * Documents are uploaded by the form afterwards, one B12 call per file
 * (uploadTripDocument), because one Server Action body is capped at 11 MB.
 * `then = "members"` is the "send an invite link" path.
 */
export async function createTripAction(draft: TripDraft, then: "trip" | "members"): Promise<CreateTripResult> {
  const user = await getCurrentUser();
  if (!TRIP_COVERS.some((c) => c.key === draft.cover)) return { error: "เลือกสีหน้าปก" };
  const checked = checkTripDraft(draft, user.name);
  if (!checked.ok) return { error: checked.error };
  const t = checked.trip;

  let trip: Trip;
  try {
    trip = await apiFetch<Trip>("/api/trips", {
      method: "POST",
      json: {
        name: t.name,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        budget: t.budget,
        cover: t.cover,
        members: t.memberNames.map((displayName) => ({ displayName })),
      },
    });
  } catch (e) {
    return { error: actionError(e).error };
  }
  try {
    await apiFetch<Invite>(`${tripPath(trip.id)}/invite`, { method: "PUT", json: { expiresIn: "7d", requireApproval: true } });
  } catch {
    // The trip exists; the owner can still create the link on the Members page.
  }
  revalidatePath("/", "layout");
  const base = `/trips/${encodeURIComponent(trip.id)}`;
  return { tripId: trip.id, href: then === "members" ? `${base}/members` : base };
}

/**
 * "แก้ไขทริป" (owner): B2 with name, destination and dates only. The backend
 * decides permission and date rules (e.g. City Legs outside the new dates) and
 * its Thai message is shown as is.
 */
export async function updateTripAction(tripId: string, draft: TripDetails): Promise<{ error: string } | { href: string }> {
  const checked = checkTripDetails(draft);
  if (!checked.ok) return { error: checked.error };
  const { name, destination, startDate, endDate } = checked.details;
  try {
    await apiFetch<Trip>(tripPath(tripId), { method: "PATCH", json: { name, destination, startDate, endDate } });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidatePath("/", "layout");
  return { href: `/trips/${encodeURIComponent(tripId)}` };
}
