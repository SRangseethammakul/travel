import { cache } from "react";
import { ApiError, apiFetch } from "./http";
import type { ID, Member, Trip, User } from "./types";

export { MOCK_USER_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookies";

/** A1 GET /api/me — the signed-in User. Signed out → /login?next=<this page>. */
export const getCurrentUser = cache(async (): Promise<User> => apiFetch<User>("/api/me"));

/** The signed-in User's id (A1). */
export async function getCurrentUserId(): Promise<ID> {
  return (await getCurrentUser()).id;
}

/**
 * A1 without the redirect: the signed-in User, or null when signed out. For
 * pages that must render signed out (Login, JoinTrip, the dev User switcher).
 */
export const getSignedInUser = cache(async (): Promise<User | null> => {
  try {
    return await apiFetch<User>("/api/me", { allowSignedOut: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});

/**
 * A3 GET /api/trips/:tripId → `{ trip, me }`, or null when the trip does not
 * exist or the User is not a Member of it (the backend answers 404 for both).
 */
export const getTripWithMe = cache(async (tripId: ID): Promise<{ trip: Trip; me: Member } | null> => {
  try {
    return await apiFetch<{ trip: Trip; me: Member }>(`/api/trips/${encodeURIComponent(tripId)}`, {
      allowTripNotFound: true,
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

/** The Current Member: the Member that the signed-in User is in this Trip (A3), or null. */
export async function getCurrentMember(tripId: ID): Promise<Member | null> {
  return (await getTripWithMe(tripId))?.me ?? null;
}
