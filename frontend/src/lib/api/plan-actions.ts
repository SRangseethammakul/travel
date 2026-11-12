"use server";

/**
 * Writes for places, tags, areas, the plan, Transit and City Legs (B2, B12,
 * B15–B28). Forms are checked here only for fast feedback; the backend decides
 * permissions and its Thai message is shown when it refuses.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPlaceDraft, cleanLabel, cleanTagName, MAX_TAG_NAME, type PlaceDraft } from "@/lib/place-form";
import { checkHop, checkLegs, checkTransitDraft, checkVisitDraft, type TransitDraft, type VisitDraft } from "@/lib/plan-form";
import { itemDay, tripDayCount } from "@/lib/plan";
import { uploadDocument } from "./documents";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import { getDocuments, getPlaces, getTrip } from "./queries";
import type { CityLeg, ID, Place, PlanItem, TransitPlanItem } from "./types";

const refresh = () => revalidatePath("/", "layout");
const tripBase = (tripId: ID) => `/trips/${encodeURIComponent(tripId)}`;
const tagPath = (tagId: ID) => `/api/me/tags/${encodeURIComponent(tagId)}`;

/** Runs a backend write; an ApiError becomes `{ error }` with the backend's Thai message. */
async function write(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
  } catch (e) {
    return { error: actionError(e).error };
  }
  refresh();
  return null;
}

// ── Places (8 / 15) ─────────────────────────────────────────────────────────

/** B15 — save a Place to the trip's list; `then: "plan"` continues to PickPlace with it selected. */
export async function savePlace(tripId: ID, draft: PlaceDraft, then: "list" | "plan"): Promise<ActionResult> {
  const checked = checkPlaceDraft(draft);
  if (!checked.ok) return { error: checked.error };
  let place: Place;
  try {
    place = await apiFetch<Place>(`${tripPath(tripId)}/places`, {
      method: "POST",
      json: {
        name: checked.name,
        type: draft.type,
        city: checked.city,
        area: checked.area,
        tagIds: checked.tagIds,
        // The backend reuses a tag with the same name (mine, then the trip's) or creates one for me.
        newTags: checked.newTagNames,
        ...(checked.mapUrl ? { mapUrl: checked.mapUrl } : {}),
        note: checked.note,
      },
    });
  } catch (e) {
    return { error: actionError(e).error };
  }
  refresh();
  redirect(then === "plan" ? `${tripBase(tripId)}/plan/add?place=${encodeURIComponent(place.id)}` : `${tripBase(tripId)}/places`);
}

/** B23 — ManageTags "ย่านในทริปนี้": rename or merge an area typed differently (owner). */
export async function renameAreaAction(tripId: ID, city: string, from: string, to: string): Promise<ActionResult> {
  const name = cleanLabel(to);
  if (name.length > 40) return { error: "ชื่อย่านยาวเกินไป" };
  let updated = 0;
  const r = await write(async () => {
    ({ updatedPlaces: updated } = await apiFetch<{ updatedPlaces: number }>(`${tripPath(tripId)}/areas`, {
      method: "PATCH",
      json: { city, from, to: name || null },
    }));
  });
  if (r) return r;
  return updated ? null : { error: "ไม่พบย่านนี้แล้ว" };
}

// ── Tags (17) — B20 / B21; the backend allows only the tag's owner ──────────

function checkGroup(group: string): string | null {
  const g = cleanLabel(group);
  return g && g.length <= 30 ? g : null;
}

const setGroup = (tagId: ID, group: string | null) => apiFetch(tagPath(tagId), { method: "PATCH", json: { group } });

export async function moveTagToGroup(tagId: ID, group: string | null): Promise<ActionResult> {
  const g = group === null ? null : checkGroup(group);
  if (group !== null && !g) return { error: "ชื่อกลุ่มต้องยาว 1–30 ตัวอักษร" };
  return write(() => setGroup(tagId, g));
}

export async function renameTagAction(tagId: ID, name: string): Promise<ActionResult> {
  const n = cleanTagName(name);
  if (!n || n.length > MAX_TAG_NAME) return { error: `ชื่อ tag ต้องยาว 1–${MAX_TAG_NAME} ตัวอักษร` };
  return write(() => apiFetch(tagPath(tagId), { method: "PATCH", json: { name: n } }));
}

export async function deleteTagAction(tagId: ID): Promise<ActionResult> {
  return write(() => apiFetch(tagPath(tagId), { method: "DELETE" }));
}

/** "สร้างกลุ่มใหม่": a group exists once at least one tag is in it. */
export async function createTagGroup(name: string, tagIds: ID[]): Promise<ActionResult> {
  const g = checkGroup(name);
  if (!g) return { error: "ชื่อกลุ่มต้องยาว 1–30 ตัวอักษร" };
  if (!tagIds.length) return { error: "เลือก tag อย่างน้อย 1 อันเข้ากลุ่มนี้" };
  return write(() => Promise.all(tagIds.map((id) => setGroup(id, g))));
}

/** Group options "ยกเลิกกลุ่ม": move the group's tags back to ไม่มีกลุ่ม. */
export async function ungroupTags(tagIds: ID[]): Promise<ActionResult> {
  return write(() => Promise.all(tagIds.map((id) => setGroup(id, null))));
}

// ── Plan (13) ───────────────────────────────────────────────────────────────

/** B24 — one Place on several days at once. */
export async function addToPlan(tripId: ID, draft: VisitDraft): Promise<ActionResult> {
  const [trip, places] = await Promise.all([getTrip(tripId), getPlaces(tripId)]);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const checked = checkVisitDraft(draft, places.map((p) => p.id), tripDayCount(trip));
  if (!checked.ok) return { error: checked.error };
  const r = await write(() =>
    apiFetch(`${tripPath(tripId)}/plan/places`, {
      method: "POST",
      json: { placeId: draft.placeId, days: checked.days, time: checked.time, note: checked.note },
    }),
  );
  if (r) return r;
  redirect(`${tripBase(tripId)}/plan?day=${checked.days[0]}`);
}

/** B27 — Hop sheet in the Planner. `input = null` removes the Hop. */
export async function saveHop(tripId: ID, itemId: ID, input: { mode: string; minutes: string; note: string } | null): Promise<ActionResult> {
  const path = `${tripPath(tripId)}/plan/${encodeURIComponent(itemId)}/hop`;
  if (!input) return write(() => apiFetch(path, { method: "DELETE" }));
  const checked = checkHop(input);
  if (!checked.ok) return { error: checked.error };
  return write(() => apiFetch(path, { method: "PUT", json: checked.hop }));
}

// ── Transit (18) ────────────────────────────────────────────────────────────

/**
 * "อัปโหลดเอกสารใหม่" (AddTransit) and CreateTrip's documents: B12 (a trip
 * document, not a slip) → the new document id. An optional `name` field names it.
 */
export async function uploadTripDocument(tripId: ID, form: FormData): Promise<{ error: string } | { id: ID }> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "เลือกไฟล์ก่อน" };
  if (file.size > 10 * 1024 * 1024 || !/^(image\/|application\/pdf$)/.test(file.type)) {
    return { error: "อัปโหลดได้เฉพาะรูปหรือ PDF ขนาดไม่เกิน 10 MB" };
  }
  try {
    const name = form.get("name");
    const doc = await uploadDocument(tripId, file, typeof name === "string" ? name : undefined);
    refresh();
    return { id: doc.id };
  } catch (e) {
    return { error: actionError(e).error };
  }
}

/**
 * B25 — save a booked Transit. With `cost` (satang > 0) it continues to AddExpense,
 * prefilled as a "เดินทาง" expense that is linked back to this Transit on save.
 */
export async function saveTransit(tripId: ID, draft: TransitDraft, cost: number | null): Promise<ActionResult> {
  const [trip, docs] = await Promise.all([getTrip(tripId), getDocuments(tripId)]);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const checked = checkTransitDraft(draft, trip, docs.map((d) => d.id));
  if (!checked.ok) return { error: checked.error };
  if (cost !== null && (!Number.isSafeInteger(cost) || cost <= 0)) return { error: "ใส่ค่าโดยสารรวมมากกว่า 0" };
  let item: TransitPlanItem;
  try {
    item = await apiFetch<TransitPlanItem>(`${tripPath(tripId)}/plan/transits`, {
      method: "POST",
      json: {
        mode: draft.mode,
        fromText: checked.fromText,
        toText: checked.toText,
        ...(checked.fromCode ? { fromCode: checked.fromCode } : {}),
        ...(checked.toCode ? { toCode: checked.toCode } : {}),
        departAt: checked.departAt,
        arriveAt: checked.arriveAt,
        ...(checked.bookingRef ? { bookingRef: checked.bookingRef } : {}),
        docIds: checked.docIds,
        ...(draft.fromPlaceId ? { fromPlaceId: draft.fromPlaceId } : {}),
        ...(draft.toPlaceId ? { toPlaceId: draft.toPlaceId } : {}),
      },
    });
  } catch (e) {
    return { error: actionError(e).error };
  }
  refresh();
  if (cost !== null) redirect(`${tripBase(tripId)}/expenses/new?transit=${encodeURIComponent(item.id)}&amount=${cost}`);
  redirect(`${tripBase(tripId)}/plan?day=${Math.max(1, itemDay(item as PlanItem, trip))}`);
}

// ── City Legs (16) ──────────────────────────────────────────────────────────

/** B2 `legs` (owner); an empty list removes the route. */
export async function saveLegs(tripId: ID, legs: CityLeg[]): Promise<ActionResult> {
  const trip = await getTrip(tripId);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const checked = checkLegs(legs, trip);
  if (!checked.ok) return { error: checked.error };
  return write(() => apiFetch(tripPath(tripId), { method: "PATCH", json: { legs: checked.legs.length ? checked.legs : null } }));
}
