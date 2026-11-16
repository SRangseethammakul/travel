"use server";

/**
 * Writes for places, tags, areas, the plan, Transit and City Legs (B2, B12,
 * B15–B28). Forms are checked here only for fast feedback; the backend decides
 * permissions and its Thai message is shown when it refuses.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPlaceDraft, cleanLabel, cleanTagName, MAX_TAG_NAME, stayPlanSync, stayTripDays, type PlaceDraft } from "@/lib/place-form";
import { checkHop, checkLegs, checkTransitDraft, checkVisitDraft, checkVisitEdit, transitPatchBody, type TransitDraft, type VisitDraft, type VisitEdit } from "@/lib/plan-form";
import { itemDay, tripDayCount } from "@/lib/plan";
import { uploadDocument } from "./documents";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import { getDocuments, getExpense, getPlanItems, getPlaces, getTrip } from "./queries";
import type { CityLeg, ID, Place, PlaceStay, PlanItem, TransitPlanItem } from "./types";

const refresh = () => revalidatePath("/", "layout");
const tripBase = (tripId: ID) => `/trips/${encodeURIComponent(tripId)}`;
/** AddExpense prefilled from a hotel's stay (title, ที่พัก, check-in date and price are read from the Place). */
const stayExpenseHref = (base: string, placeId: ID) => `${base}/expenses/new?stay=${encodeURIComponent(placeId)}`;
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

/**
 * B15 — save a Place to the trip's list. `then: "plan"` continues to PickPlace with it selected.
 * A hotel with stay dates goes onto the plan for those days by itself and opens the plan.
 */
export async function savePlace(tripId: ID, draft: PlaceDraft, then: "list" | "plan", fromDay?: number, asExpense = false): Promise<ActionResult> {
  const checked = checkPlaceDraft(draft);
  if (!checked.ok) return { error: checked.error };
  let place: Place;
  try {
    place = await apiFetch<Place>(`${tripPath(tripId)}/places`, {
      method: "POST",
      json: {
        name: checked.name,
        type: checked.type,
        city: checked.city,
        area: checked.area,
        tagIds: checked.tagIds,
        // The backend reuses a tag with the same name (mine, then the trip's) or creates one for me.
        newTags: checked.newTagNames,
        ...(checked.mapUrl ? { mapUrl: checked.mapUrl } : {}),
        note: checked.note,
        ...(checked.stay ? { stay: checked.stay } : {}),
      },
    });
  } catch (e) {
    return { error: actionError(e).error };
  }
  if (checked.stay) {
    const trip = await getTrip(tripId);
    const days = trip ? stayTripDays(checked.stay, trip) : [];
    let placed = false;
    if (days.length) {
      try {
        await apiFetch(`${tripPath(tripId)}/plan/places`, { method: "POST", json: { placeId: place.id, days, time: null, note: "" } });
        placed = true;
      } catch {
        // Saved but not placed on the plan: fall through to the normal ending.
      }
    }
    refresh();
    // "บันทึกเป็นค่าใช้จ่ายด้วย": continue to AddExpense prefilled from this stay.
    if (asExpense && checked.stay.price) redirect(stayExpenseHref(tripBase(tripId), place.id));
    if (placed) redirect(`${tripBase(tripId)}/plan?day=${days[0]}`);
  }
  refresh();
  redirect(then === "plan" ? `${tripBase(tripId)}/plan/add?place=${encodeURIComponent(place.id)}${fromDay ? `&day=${fromDay}` : ""}` : `${tripBase(tripId)}/places`);
}

/**
 * B16 — edit a Place (owner, or the editor who added it). Hotel fields are removed when the type is no longer "stay".
 * The plan follows the stay: days dropped from the stay lose their untouched visit, new days get one (see `stayPlanSync`).
 * `asExpense` continues to AddExpense for the hotel's price (offered only when the hotel had no price before, so a
 * later edit cannot create a second expense for the same stay).
 */
export async function updatePlaceAction(
  tripId: ID,
  placeId: ID,
  draft: PlaceDraft,
  prevStay: PlaceStay | null,
  opts: { asExpense?: boolean; expenseSync?: "update" | "manual" | null } = {},
): Promise<ActionResult> {
  const { asExpense = false, expenseSync = null } = opts;
  const checked = checkPlaceDraft(draft);
  if (!checked.ok) return { error: checked.error };
  // PATCH replaces `stay` whole: keep the link to the Expense, or every hotel edit would unlink it.
  const stayBody = checked.stay ? { ...checked.stay, ...(prevStay?.expenseId ? { expenseId: prevStay.expenseId } : {}) } : null;
  const r = await write(() =>
    apiFetch(`${tripPath(tripId)}/places/${encodeURIComponent(placeId)}`, {
      method: "PATCH",
      json: {
        name: checked.name,
        type: checked.type,
        city: checked.city,
        area: checked.area,
        tagIds: checked.tagIds,
        newTags: checked.newTagNames,
        mapUrl: checked.mapUrl ?? null,
        note: checked.note,
        ...(stayBody ? { stay: stayBody } : prevStay ? { stay: null } : {}),
      },
    }),
  );
  if (r) return r;
  if (checked.stay || prevStay) {
    const [trip, items] = await Promise.all([getTrip(tripId), getPlanItems(tripId)]);
    if (trip) {
      const visits = items.flatMap((i) => (i.kind === "place" && i.placeId === placeId ? [{ id: i.id, day: i.day, time: i.time, note: i.note }] : []));
      const sync = stayPlanSync(visits, prevStay, checked.stay, trip);
      try {
        for (const id of sync.removeIds) await apiFetch(`${tripPath(tripId)}/plan/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (sync.addDays.length) {
          await apiFetch(`${tripPath(tripId)}/plan/places`, { method: "POST", json: { placeId, days: sync.addDays, time: null, note: "" } });
        }
      } catch (e) {
        refresh();
        return { error: `บันทึกที่พักแล้ว แต่ปรับแผนรายวันไม่สำเร็จ: ${actionError(e).error}` };
      }
      refresh();
    }
  }
  // The hotel's price changed and the user chose to follow it with the linked cost.
  const linkedId = prevStay?.expenseId;
  if (linkedId && checked.stay?.price && expenseSync === "manual") redirect(`${tripBase(tripId)}/expenses/${encodeURIComponent(linkedId)}/edit`);
  if (linkedId && checked.stay?.price && expenseSync === "update") {
    try {
      const expense = await getExpense(tripId, linkedId);
      // Equal split only: the server re-splits among the same Members, exactly as the expense form sends it.
      if (expense && expense.splitMode === "equal") {
        await apiFetch(`${tripPath(tripId)}/expenses/${encodeURIComponent(linkedId)}`, {
          method: "PATCH",
          json: { amount: checked.stay.price, splitMode: "equal", shares: expense.shares.map((sh) => ({ memberId: sh.memberId })) },
        });
      }
    } catch (e) {
      refresh();
      return { error: `บันทึกที่พักแล้ว แต่แก้ยอดค่าใช้จ่ายไม่สำเร็จ: ${actionError(e).error}` };
    }
    refresh();
  }
  if (asExpense && checked.stay?.price && !linkedId) redirect(stayExpenseHref(tripBase(tripId), placeId));
  redirect(`${tripBase(tripId)}/places`);
}

/**
 * B17 — delete a Place and its visits (409 while a Transit starts or ends there; the Thai message is shown).
 * `alsoExpenseId`: the hotel's linked Expense, deleted too (B31) once the Place is gone, so a refused hotel
 * delete never costs the user the expense.
 */
export async function deletePlaceAction(tripId: ID, placeId: ID, alsoExpenseId?: ID): Promise<ActionResult> {
  const r = await write(() => apiFetch(`${tripPath(tripId)}/places/${encodeURIComponent(placeId)}`, { method: "DELETE" }));
  if (r) return r;
  if (alsoExpenseId) {
    try {
      await apiFetch<void>(`${tripPath(tripId)}/expenses/${encodeURIComponent(alsoExpenseId)}`, { method: "DELETE" });
    } catch {
      // The hotel is gone but its cost could not be deleted: land on that expense so the user can finish it.
      refresh();
      redirect(`${tripBase(tripId)}/expenses/${encodeURIComponent(alsoExpenseId)}`);
    }
    refresh();
  }
  redirect(`${tripBase(tripId)}/places`);
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

/** B26 — change a visit's time / note / day. After moving it to another day the planner opens on that day. */
export async function updateVisitAction(tripId: ID, itemId: ID, fromDay: number, edit: VisitEdit): Promise<ActionResult> {
  const trip = await getTrip(tripId);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const checked = checkVisitEdit(edit, tripDayCount(trip));
  if (!checked.ok) return { error: checked.error };
  const r = await write(() =>
    apiFetch(`${tripPath(tripId)}/plan/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      json: { ...(checked.day !== null ? { day: checked.day } : {}), time: checked.time, note: checked.note },
    }),
  );
  if (r) return r;
  if (checked.day !== null && checked.day !== fromDay) redirect(`${tripBase(tripId)}/plan?day=${checked.day}`);
  return null;
}

/** Takes one visit off a day. The Place stays in the trip's list. */
export async function removePlanItemAction(tripId: ID, itemId: ID): Promise<ActionResult> {
  return write(() => apiFetch(`${tripPath(tripId)}/plan/${encodeURIComponent(itemId)}`, { method: "DELETE" }));
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
        ...(checked.seatInfo ? { seatInfo: checked.seatInfo } : {}),
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

/** B26 — save an edited Transit, then open the planner on its departure day. A linked expense stays linked. */
export async function updateTransitAction(tripId: ID, itemId: ID, draft: TransitDraft): Promise<ActionResult> {
  const [trip, docs, items] = await Promise.all([getTrip(tripId), getDocuments(tripId), getPlanItems(tripId)]);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const checked = checkTransitDraft(draft, trip, docs.map((d) => d.id));
  if (!checked.ok) return { error: checked.error };
  const prev = items.find((i): i is TransitPlanItem => i.id === itemId && i.kind === "transit");
  let item: TransitPlanItem;
  try {
    item = await apiFetch<TransitPlanItem>(`${tripPath(tripId)}/plan/${encodeURIComponent(itemId)}`, { method: "PATCH", json: transitPatchBody(checked, draft, prev) });
  } catch (e) {
    return { error: actionError(e).error };
  }
  refresh();
  redirect(`${tripBase(tripId)}/plan?day=${Math.max(1, itemDay(item as PlanItem, trip))}`);
}

/**
 * B28 — delete a Transit. `alsoExpenseId`: its linked Expense, deleted too (B31) once the Transit is gone
 * (deleting a Transit never touches the Expense by itself).
 */
export async function deleteTransitAction(tripId: ID, itemId: ID, alsoExpenseId?: ID): Promise<ActionResult> {
  const r = await write(() => apiFetch(`${tripPath(tripId)}/plan/${encodeURIComponent(itemId)}`, { method: "DELETE" }));
  if (r) return r;
  if (alsoExpenseId) {
    try {
      await apiFetch<void>(`${tripPath(tripId)}/expenses/${encodeURIComponent(alsoExpenseId)}`, { method: "DELETE" });
    } catch {
      // The Transit is gone but its cost could not be deleted: land on that expense so the user can finish it.
      refresh();
      redirect(`${tripBase(tripId)}/expenses/${encodeURIComponent(alsoExpenseId)}`);
    }
    refresh();
  }
  return null;
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
