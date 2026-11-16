/**
 * Read functions (docs/api/API.md Part A). Components get data only through
 * lib/api; every read goes to the backend through apiFetch (docs/adr/0001).
 */
import { localizePlacePhotos } from "./place-photos";
import { redirect } from "next/navigation";
import { itemDay } from "@/lib/plan";
import { ApiError, apiFetch, nullOn404, tripPath } from "./http";
import { getTripWithMe } from "./session";
import type {
  Activity,
  ChecklistItem,
  Expense,
  ID,
  Invite,
  Member,
  MyTrip,
  PersonalExpense,
  Place,
  PlanItem,
  Settlement,
  Tag,
  Trip,
  TripBalances,
  TripDocument,
  User,
} from "./types";

// ── Users & trips ───────────────────────────────────────────────────────────

/** A17 GET /api/dev/users — every User, for the dev User switcher (404 outside development). */
export async function listUsers(): Promise<User[]> {
  return apiFetch<User[]>("/api/dev/users", { allowSignedOut: true });
}

/** A3: the trip, or null when it does not exist or the User is not a Member of it. */
export async function getTrip(tripId: ID): Promise<Trip | null> {
  return (await getTripWithMe(tripId))?.trip ?? null;
}

/** A2 GET /api/trips — trips the current User is a Member of, soonest first, with their Outstanding. */
export async function listMyTrips(): Promise<MyTrip[]> {
  return apiFetch<MyTrip[]>("/api/trips");
}

/**
 * Trip + Current Member for a trip page (A3). Sends the User to /trips when the
 * trip does not exist or they are not a Member of it.
 */
export async function requireTripMember(tripId: ID): Promise<{ trip: Trip; me: Member }> {
  const found = await getTripWithMe(tripId);
  if (!found) redirect("/trips");
  return found;
}

/** A4 GET /api/trips/:tripId/members — includes `pending` Members (see Member.status). */
export async function getMembers(tripId: ID): Promise<Member[]> {
  return apiFetch<Member[]>(`${tripPath(tripId)}/members`);
}

/** A5 GET /api/trips/:tripId/invite — owner only; other roles (403) and "no invite yet" get null. */
export async function getInvite(tripId: ID): Promise<Invite | null> {
  try {
    return await apiFetch<Invite | null>(`${tripPath(tripId)}/invite`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
}

/** A6 GET /api/trips/:tripId/documents — no file URLs (B13 signs them). */
export async function getDocuments(tripId: ID): Promise<TripDocument[]> {
  return apiFetch<TripDocument[]>(`${tripPath(tripId)}/documents`);
}

/** GET /api/trips/:tripId/documents/:docId — one Document (slips are not in A6), or null. */
export async function getDocument(tripId: ID, docId: ID): Promise<TripDocument | null> {
  return nullOn404(apiFetch<TripDocument>(`${tripPath(tripId)}/documents/${encodeURIComponent(docId)}`));
}

// ── Places, tags, plan ──────────────────────────────────────────────────────

/** A7 GET /api/trips/:tripId/places */
export async function getPlaces(tripId: ID): Promise<Place[]> {
  return (await apiFetch<Place[]>(`${tripPath(tripId)}/places`)).map(localizePlacePhotos);
}

/** A8 GET /api/trips/:tripId/tags — tags used on any Place in the trip (the Places filter). */
export async function getTripTags(tripId: ID): Promise<Tag[]> {
  return apiFetch<Tag[]>(`${tripPath(tripId)}/tags`);
}

/** A9 GET /api/me/tags — the signed-in User's own tags (ManageTags, AddPlace). */
export async function getUserTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>("/api/me/tags");
}

/** Trip day (1-based) a Plan Item belongs to. */
export function planItemDay(item: PlanItem, trip: Pick<Trip, "startDate">): number {
  return itemDay(item, trip);
}

/** "HH:mm" sort key, untimed items last. */
export function planItemTime(item: PlanItem): string {
  if (item.kind === "transit") return item.departAt.slice(11, 16);
  return item.time ?? "99:99";
}

/** A10 GET /api/trips/:tripId/plan — sorted by day, then time (untimed last), then insertion order. */
export async function getPlanItems(tripId: ID): Promise<PlanItem[]> {
  return apiFetch<PlanItem[]>(`${tripPath(tripId)}/plan`);
}

/** Place ids that appear in the plan (as a visit or as a transit endpoint). */
export function scheduledPlaceIds(items: readonly PlanItem[]): Set<ID> {
  const ids = new Set<ID>();
  for (const item of items) {
    if (item.kind === "place") ids.add(item.placeId);
    else for (const id of [item.fromPlaceId, item.toPlaceId]) if (id) ids.add(id);
  }
  return ids;
}

// ── Money ───────────────────────────────────────────────────────────────────

/** A11 GET /api/trips/:tripId/expenses — every Expense (viewers too), by date then createdAt. */
export async function getExpenses(tripId: ID): Promise<Expense[]> {
  return apiFetch<Expense[]>(`${tripPath(tripId)}/expenses`);
}

/** A12 GET /api/trips/:tripId/expenses/:expenseId, or null. */
export async function getExpense(tripId: ID, expenseId: ID): Promise<Expense | null> {
  return nullOn404(apiFetch<Expense>(`${tripPath(tripId)}/expenses/${encodeURIComponent(expenseId)}`));
}

/** B44 GET /api/trips/:tripId/personal-expenses — the Current Member's own records, by date then createdAt. */
export async function getPersonalExpenses(tripId: ID): Promise<PersonalExpense[]> {
  return apiFetch<PersonalExpense[]>(`${tripPath(tripId)}/personal-expenses`);
}

/** A13 GET /api/trips/:tripId/settlements — every Settlement (viewers too). */
export async function getSettlements(tripId: ID): Promise<Settlement[]> {
  return apiFetch<Settlement[]>(`${tripPath(tripId)}/settlements`);
}

/**
 * A14 GET /api/trips/:tripId/balances — Net Balance (Summary table) and
 * Outstanding (cards, SettleUp), plus Suggested Transfers from Outstanding. The
 * backend gives a viewer only their own row and the transfers they send or
 * receive; `total` is whole-trip.
 */
export async function getTripBalances(tripId: ID): Promise<TripBalances> {
  return apiFetch<TripBalances>(`${tripPath(tripId)}/balances`);
}

// ── Checklist & activity ────────────────────────────────────────────────────

/**
 * A15 GET /api/trips/:tripId/checklist — group items plus the Current Member's
 * own personal items. The backend filters by session; no viewer id is sent.
 */
export async function getChecklist(tripId: ID): Promise<ChecklistItem[]> {
  return apiFetch<ChecklistItem[]>(`${tripPath(tripId)}/checklist`);
}

/**
 * A16 GET /api/trips/:tripId/activity — newest first. Pages filter by type and
 * count unread themselves, so this asks for one page of the maximum size
 * (100) and does not use `type`; older items need `before`/`beforeId` paging,
 * which no page offers yet.
 */
export async function getActivity(tripId: ID): Promise<Activity[]> {
  return apiFetch<Activity[]>(`${tripPath(tripId)}/activity?limit=100`);
}
