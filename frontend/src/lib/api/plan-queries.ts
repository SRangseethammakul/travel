/**
 * Read functions for the Phase 4 pages (AddPlace, ManageTags, PickPlace,
 * AddTransit, TripRoute). Same rules as queries.ts: backend reads only.
 */
import { apiFetch, nullOn404, tripPath } from "./http";
import { localizePlacePhotos } from "./place-photos";
import { getUserTags } from "./queries";
import type { ID, Place, Tag } from "./types";

/** GET /api/trips/:tripId/places/:placeId, or null. */
export async function getPlace(tripId: ID, placeId: ID): Promise<Place | null> {
  const place = await nullOn404(apiFetch<Place>(`${tripPath(tripId)}/places/${encodeURIComponent(placeId)}`));
  return place ? localizePlacePhotos(place) : null;
}

/**
 * B22 GET /api/me/tags/usage — how many Places (in any trip) carry each of the
 * signed-in User's tags. ManageTags shows this count and the delete
 * confirmation names it. Tags on no Place are left out.
 */
export async function getTagUsage(): Promise<Record<ID, number>> {
  return apiFetch<Record<ID, number>>("/api/me/tags/usage");
}

/**
 * One of the signed-in User's own tags, or null. There is no single-tag
 * endpoint, so this looks it up in A9; another User's tag reads as null.
 */
export async function getTag(tagId: ID): Promise<Tag | null> {
  return (await getUserTags()).find((t) => t.id === tagId) ?? null;
}
