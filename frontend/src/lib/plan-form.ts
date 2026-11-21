/**
 * PickPlace (13), AddTransit + Hop (18) and TripRoute (16) helpers. Pure.
 */
import type { CityLeg, Hop, HopMode, ID, Place, PlanItem, TransitMode, TransitPlanItem, Trip } from "@/lib/api/types";
import { itemDay, legCity, placeDays, tripDayCount } from "@/lib/plan";

// ── PickPlace ───────────────────────────────────────────────────────────────

export interface PickRow<P> {
  place: P;
  /** Days the Place is already on. */
  days: number[];
}

export interface PickSection<P> {
  key: "near" | "city" | "rest";
  title: string;
  sub: string;
  rows: PickRow<P>[];
}

/**
 * Places that can be added to `day` (not already on it), split into:
 * 1. same area as the day's plan ("ย่านเดียวกับแผนวันที่ N"),
 * 2. same city as the day's City Leg (multi-city trips),
 * 3. everything else, sorted by area (no area last).
 */
export function pickSections<P extends Pick<Place, "id" | "city" | "area" | "name">>(
  places: readonly P[],
  items: readonly PlanItem[],
  trip: Pick<Trip, "startDate" | "legs">,
  day: number,
): PickSection<P>[] {
  const days = placeDays(items, trip);
  const byId = new Map(places.map((p) => [p.id, p]));
  const focusAreas: string[] = [];
  for (const item of items) {
    if (item.kind !== "place" || itemDay(item, trip) !== day) continue;
    const area = byId.get(item.placeId)?.area;
    if (area && !focusAreas.includes(area)) focusAreas.push(area);
  }
  const city = trip.legs?.length ? legCity(trip.legs, day) : null;
  const candidates = places.filter((p) => !(days.get(p.id) ?? []).includes(day)).map((place) => ({ place, days: days.get(place.id) ?? [] }));

  const near = candidates.filter((r) => r.place.area && focusAreas.includes(r.place.area) && (!city || r.place.city === city));
  const left = candidates.filter((r) => !near.includes(r));
  const sameCity = city ? left.filter((r) => r.place.city === city) : [];
  const rest = left.filter((r) => !sameCity.includes(r));
  const byArea = (a: PickRow<P>, b: PickRow<P>) =>
    (a.place.area ?? "￿").localeCompare(b.place.area ?? "￿", "th") || a.place.name.localeCompare(b.place.name, "th");

  return [
    { key: "near" as const, title: `ย่านเดียวกับแผนวันที่ ${day}`, sub: `วันนี้คุณไป ${focusAreas.join(" และ ")} อยู่แล้ว`, rows: near },
    { key: "city" as const, title: `ที่อื่นใน ${city ?? ""}`, sub: `วันที่ ${day} อยู่ที่ ${city ?? ""}`, rows: sameCity.sort(byArea) },
    { key: "rest" as const, title: "ที่อื่นในลิสต์", sub: "เรียงตามย่าน", rows: rest.sort(byArea) },
  ].filter((s) => s.rows.length);
}

/** "HH:mm" or empty (untimed). */
export function isTime(text: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

export interface VisitDraft {
  placeId: ID;
  days: number[];
  /** "" = no time yet */
  time: string;
  note: string;
}

export type VisitResult = { ok: true; days: number[]; time: string | null; note: string } | { ok: false; error: string };

export function checkVisitDraft(draft: VisitDraft, placeIds: readonly ID[], dayCount: number): VisitResult {
  if (!placeIds.includes(draft.placeId)) return { ok: false, error: "เลือกสถานที่" };
  const days = [...new Set(draft.days)].sort((a, b) => a - b);
  if (!days.length) return { ok: false, error: "เลือกอย่างน้อย 1 วัน" };
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > dayCount)) return { ok: false, error: "วันที่อยู่นอกช่วงทริป" };
  const time = draft.time.trim();
  if (time && !isTime(time)) return { ok: false, error: "เวลาไม่ถูกต้อง" };
  const note = draft.note.trim();
  if (note.length > 200) return { ok: false, error: "โน้ตยาวได้ไม่เกิน 200 ตัวอักษร" };
  return { ok: true, days, time: time || null, note };
}

/** Edit of a visit already on the plan. `day: null` leaves the day alone (a hotel's days follow its stay). */
export interface VisitEdit {
  day: number | null;
  /** "" clears the time */
  time: string;
  note: string;
}

export type VisitEditResult = { ok: true; day: number | null; time: string | null; note: string } | { ok: false; error: string };

export function checkVisitEdit(edit: VisitEdit, dayCount: number): VisitEditResult {
  if (edit.day !== null && (!Number.isInteger(edit.day) || edit.day < 1 || edit.day > dayCount)) return { ok: false, error: "วันที่อยู่นอกช่วงทริป" };
  const time = edit.time.trim();
  if (time && !isTime(time)) return { ok: false, error: "เวลาไม่ถูกต้อง" };
  const note = edit.note.trim();
  if (note.length > 200) return { ok: false, error: "โน้ตยาวได้ไม่เกิน 200 ตัวอักษร" };
  return { ok: true, day: edit.day, time: time || null, note };
}

// ── Hop ─────────────────────────────────────────────────────────────────────

export const HOP_MODES: readonly HopMode[] = ["walk", "train", "bus", "taxi", "car"];

export function checkHop(input: { mode: string; minutes: string; note: string }): { ok: true; hop: Hop } | { ok: false; error: string } {
  if (!HOP_MODES.includes(input.mode as HopMode)) return { ok: false, error: "เลือกวิธีเดินทาง" };
  const minText = input.minutes.trim();
  let minutes: number | undefined;
  if (minText) {
    if (!/^\d{1,4}$/.test(minText)) return { ok: false, error: "ใส่นาทีเป็นตัวเลข" };
    minutes = Number(minText);
    if (minutes > 1440) return { ok: false, error: "นาทีมากเกินไป" };
  }
  const note = input.note.trim();
  if (note.length > 80) return { ok: false, error: "โน้ตยาวได้ไม่เกิน 80 ตัวอักษร" };
  return { ok: true, hop: { mode: input.mode as HopMode, ...(minutes ? { minutes } : {}), ...(note ? { note } : {}) } };
}

// ── Transit ─────────────────────────────────────────────────────────────────

export const TRANSIT_MODES: readonly TransitMode[] = ["plane", "train", "bus", "car", "boat", "walk", "other"];

export interface TransitDraft {
  mode: TransitMode;
  fromText: string;
  toText: string;
  /** "2026-12-15" */
  departDate: string;
  /** "18:00" */
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  bookingRef: string;
  /** "" = none */
  seatInfo?: string;
  docIds: ID[];
  fromPlaceId?: ID;
  toPlaceId?: ID;
}

export type TransitResult =
  | { ok: true; fromText: string; toText: string; fromCode?: string; toCode?: string; departAt: string; arriveAt: string; bookingRef?: string; seatInfo?: string; docIds: ID[] }
  | { ok: false; error: string };

/** "สนามบินฮาเนดะ (HND)" → { text: "สนามบินฮาเนดะ", code: "HND" } */
export function splitPlaceCode(text: string): { text: string; code?: string } {
  const m = /^(.*?)\s*\(([A-Z0-9]{2,4})\)\s*$/.exec(text.trim());
  return m && m[1] ? { text: m[1], code: m[2] } : { text: text.trim() };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function checkTransitDraft(draft: TransitDraft, trip: Pick<Trip, "startDate" | "endDate">, docIds: readonly ID[]): TransitResult {
  if (!TRANSIT_MODES.includes(draft.mode)) return { ok: false, error: "เลือกประเภท" };
  const from = splitPlaceCode(draft.fromText);
  const to = splitPlaceCode(draft.toText);
  if (!from.text || !to.text) return { ok: false, error: "ใส่ต้นทางและปลายทาง" };
  if (from.text.length > 80 || to.text.length > 80) return { ok: false, error: "ชื่อต้นทาง/ปลายทางยาวเกินไป" };
  if (!ISO_DATE.test(draft.departDate) || !isTime(draft.departTime)) return { ok: false, error: "ใส่วันและเวลาออก" };
  if (!ISO_DATE.test(draft.arriveDate) || !isTime(draft.arriveTime)) return { ok: false, error: "ใส่วันและเวลาถึง" };
  if (draft.departDate < trip.startDate || draft.departDate > trip.endDate) return { ok: false, error: "วันออกต้องอยู่ในช่วงทริป" };
  // Times are local to each end (timezones are an open SPEC item), so arrival may look earlier than departure.
  const bookingRef = draft.bookingRef.trim();
  if (bookingRef.length > 40) return { ok: false, error: "เลขที่จองยาวเกินไป" };
  const seatInfo = (draft.seatInfo ?? "").trim();
  if (seatInfo.length > 200) return { ok: false, error: "ข้อมูลที่นั่งยาวเกินไป" };
  if (draft.docIds.some((id) => !docIds.includes(id))) return { ok: false, error: "มีเอกสารที่ไม่ได้อยู่ในทริปนี้" };
  return {
    ok: true,
    fromText: from.text,
    toText: to.text,
    ...(from.code ? { fromCode: from.code } : {}),
    ...(to.code ? { toCode: to.code } : {}),
    departAt: `${draft.departDate}T${draft.departTime}`,
    arriveAt: `${draft.arriveDate}T${draft.arriveTime}`,
    ...(bookingRef ? { bookingRef } : {}),
    ...(seatInfo ? { seatInfo } : {}),
    docIds: [...new Set(draft.docIds)],
  };
}

/** Form draft of a saved Transit (edit form prefill). Code goes back into the text as "สนามบินฮาเนดะ (HND)". */
export function transitDraftFromItem(item: TransitPlanItem): TransitDraft {
  const end = (text: string, code?: string) => (code ? `${text} (${code})` : text);
  return {
    mode: item.mode,
    fromText: end(item.fromText, item.fromCode),
    toText: end(item.toText, item.toCode),
    departDate: item.departAt.slice(0, 10),
    departTime: item.departAt.slice(11, 16),
    arriveDate: item.arriveAt.slice(0, 10),
    arriveTime: item.arriveAt.slice(11, 16),
    bookingRef: item.bookingRef ?? "",
    seatInfo: item.seatInfo ?? "",
    docIds: [...item.docIds],
    ...(item.fromPlaceId ? { fromPlaceId: item.fromPlaceId } : {}),
    ...(item.toPlaceId ? { toPlaceId: item.toPlaceId } : {}),
  };
}

/**
 * B26 body for a Transit edit. Every editable field is sent so what the user cleared is cleared:
 * `null` removes an optional field (code, booking ref, seat, Place link). `expenseId` is left alone.
 */
export function transitPatchBody(
  checked: Extract<TransitResult, { ok: true }>,
  draft: Pick<TransitDraft, "mode" | "fromPlaceId" | "toPlaceId">,
  prev?: Pick<TransitPlanItem, "departAt" | "arriveAt">,
) {
  // The form has no duration field: a stored duration is wrong once the times move, so drop it.
  const moved = !prev || prev.departAt !== checked.departAt || prev.arriveAt !== checked.arriveAt;
  return {
    mode: draft.mode,
    fromText: checked.fromText,
    toText: checked.toText,
    fromCode: checked.fromCode ?? null,
    toCode: checked.toCode ?? null,
    departAt: checked.departAt,
    arriveAt: checked.arriveAt,
    bookingRef: checked.bookingRef ?? null,
    seatInfo: checked.seatInfo ?? null,
    docIds: checked.docIds,
    fromPlaceId: draft.fromPlaceId ?? null,
    toPlaceId: draft.toPlaceId ?? null,
    ...(moved ? { durationMinutes: null } : {}),
  };
}

// ── City Legs ───────────────────────────────────────────────────────────────

/** Legs sorted by first day; error when days overlap or fall outside the trip. */
export function checkLegs(legs: readonly CityLeg[], trip: Pick<Trip, "startDate" | "endDate">): { ok: true; legs: CityLeg[] } | { ok: false; error: string } {
  const dayCount = tripDayCount(trip);
  const sorted = legs.map((l) => ({ city: l.city.replace(/\s+/g, " ").trim(), from: l.from, to: l.to })).sort((a, b) => a.from - b.from);
  for (const l of sorted) {
    if (!l.city) return { ok: false, error: "ใส่ชื่อเมือง" };
    if (!Number.isInteger(l.from) || !Number.isInteger(l.to) || l.from < 1 || l.to > dayCount || l.from > l.to) {
      return { ok: false, error: `วันของ ${l.city} ต้องอยู่ระหว่างวันที่ 1–${dayCount}` };
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from <= sorted[i - 1].to) return { ok: false, error: `วันของ ${sorted[i - 1].city} กับ ${sorted[i].city} ซ้อนกัน` };
  }
  if (new Set(sorted.map((l) => l.city.toLowerCase())).size !== sorted.length) return { ok: false, error: "มีเมืองซ้ำในเส้นทาง" };
  return { ok: true, legs: sorted };
}

/** City for each trip day (null where no leg covers it). */
export function legStrip(legs: readonly CityLeg[], dayCount: number): (string | null)[] {
  return Array.from({ length: dayCount }, (_, i) => legs.find((l) => i + 1 >= l.from && i + 1 <= l.to)?.city ?? null);
}

/** First free range after the last leg, for "เพิ่มเมือง". */
export function nextFreeDays(legs: readonly CityLeg[], dayCount: number): { from: number; to: number } | null {
  const strip = legStrip(legs, dayCount);
  const from = strip.findIndex((c) => c === null);
  if (from < 0) return null;
  let to = from;
  while (to + 1 < dayCount && strip[to + 1] === null) to++;
  return { from: from + 1, to: to + 1 };
}
