/**
 * AddPlace (pages 8 / 15) and ManageTags (page 17) helpers. Pure.
 */
import type { CityLeg, ID, Place, PlaceStay, PlaceType, Tag, Trip } from "@/lib/api/types";
import { addDays, daysBetween, tripDayDate } from "@/lib/date";
import { parseBahtInput } from "@/lib/money/input";

export const PLACE_TYPES: readonly PlaceType[] = ["sight", "food", "interest", "stay", "transit"];
export const MAX_PLACE_NAME = 80;
export const MAX_NOTE = 500;
export const MAX_TAG_NAME = 30;
export const MAX_TAGS = 10;

export interface PlaceDraft {
  name: string;
  mapUrl: string;
  /** "" = not chosen yet (no default, so a hotel is never saved as a restaurant by accident). */
  type: PlaceType | "";
  city: string;
  /** "" = ไม่ระบุย่าน */
  area: string;
  /** Existing tag ids picked from suggestions. */
  tagIds: ID[];
  /** Tags typed by the user that do not exist yet (or might, by name). */
  newTagNames: string[];
  note: string;
  /** Hotel fields (type "stay" only); "" = not filled. Price is baht as typed. */
  checkIn?: string;
  checkOut?: string;
  price?: string;
  bookingRef?: string;
  address?: string;
}

export type PlaceDraftResult =
  | {
      ok: true;
      name: string;
      type: PlaceType;
      mapUrl?: string;
      city: string;
      area: string | null;
      note: string;
      tagIds: ID[];
      newTagNames: string[];
      /** Present only for a "stay" with dates. */
      stay?: PlaceStay;
    }
  | { ok: false; error: string };

/** Collapse spaces and trim (names, areas, cities). */
export function cleanLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Tag text without a leading "#". */
export function cleanTagName(text: string): string {
  return cleanLabel(text.replace(/^#+/, ""));
}

/** Only http(s) links are kept; the app never fetches them (SPEC: open only). */
export function isMapUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function checkPlaceDraft(draft: PlaceDraft): PlaceDraftResult {
  const name = cleanLabel(draft.name);
  if (!name) return { ok: false, error: "ใส่ชื่อสถานที่" };
  if (name.length > MAX_PLACE_NAME) return { ok: false, error: `ชื่อสถานที่ยาวได้ไม่เกิน ${MAX_PLACE_NAME} ตัวอักษร` };
  if (draft.type === "" || !PLACE_TYPES.includes(draft.type)) return { ok: false, error: "เลือกประเภทสถานที่ (ที่เที่ยว ที่กิน น่าสนใจ ที่พัก เดินทาง)" };
  const city = cleanLabel(draft.city);
  if (!city) return { ok: false, error: "เลือกเมือง" };
  if (city.length > 40) return { ok: false, error: "ชื่อเมืองยาวเกินไป" };
  const area = cleanLabel(draft.area);
  if (area.length > 40) return { ok: false, error: "ชื่อย่านยาวเกินไป" };
  const mapUrl = draft.mapUrl.trim();
  if (mapUrl && !isMapUrl(mapUrl)) return { ok: false, error: "ลิงก์ Google Maps ต้องขึ้นต้นด้วย https://" };
  const note = draft.note.trim();
  if (note.length > MAX_NOTE) return { ok: false, error: `โน้ตยาวได้ไม่เกิน ${MAX_NOTE} ตัวอักษร` };

  const tagIds = [...new Set(draft.tagIds)];
  const newTagNames: string[] = [];
  for (const raw of draft.newTagNames) {
    const t = cleanTagName(raw);
    if (!t) continue;
    if (t.length > MAX_TAG_NAME) return { ok: false, error: `tag ยาวได้ไม่เกิน ${MAX_TAG_NAME} ตัวอักษร` };
    if (!newTagNames.some((x) => x.toLowerCase() === t.toLowerCase())) newTagNames.push(t);
  }
  if (tagIds.length + newTagNames.length > MAX_TAGS) return { ok: false, error: `ใส่ tag ได้ไม่เกิน ${MAX_TAGS} อัน` };

  const stay = checkStayDraft(draft);
  if (stay && "error" in stay) return { ok: false, error: stay.error };

  return { ok: true, name, type: draft.type, ...(mapUrl ? { mapUrl } : {}), city, area: area || null, note, tagIds, newTagNames, ...(stay ? { stay: stay.stay } : {}) };
}

/** Hotel fields → `stay`; undefined when the type is not "stay" or no dates were filled. */
export function checkStayDraft(draft: PlaceDraft): { stay: PlaceStay } | { error: string } | undefined {
  if (draft.type !== "stay") return undefined;
  const checkIn = (draft.checkIn ?? "").trim();
  const checkOut = (draft.checkOut ?? "").trim();
  const price = (draft.price ?? "").trim();
  const bookingRef = cleanLabel(draft.bookingRef ?? "");
  const address = cleanLabel(draft.address ?? "");
  if (!checkIn && !checkOut) return price || bookingRef || address ? { error: "ใส่วันเช็คอินและเช็คเอาท์ก่อน จึงจะบันทึกราคาหรือเลขจองได้" } : undefined;
  if (!checkIn) return { error: "ใส่วันเช็คอิน" };
  if (!checkOut) return { error: "ใส่วันเช็คเอาท์" };
  if (checkOut <= checkIn) return { error: "วันเช็คเอาท์ต้องหลังวันเช็คอิน" };
  const satang = parseBahtInput(price);
  if (satang === null) return { error: "ราคาที่พักไม่ถูกต้อง" };
  if (bookingRef.length > 100) return { error: "เลขจองยาวเกินไป" };
  if (address.length > 300) return { error: "ที่อยู่ยาวเกินไป" };
  return {
    stay: { checkIn, checkOut, ...(satang > 0 ? { price: satang } : {}), ...(bookingRef ? { bookingRef } : {}), ...(address ? { address } : {}) },
  };
}

/** Trip days a stay covers, check-in day through check-out day (the last one shows "เช็คเอาท์"), clamped to the trip. */
export function stayTripDays(stay: Pick<PlaceStay, "checkIn" | "checkOut">, trip: Pick<Trip, "startDate" | "endDate">): number[] {
  const count = daysBetween(trip.startDate, trip.endDate) + 1;
  const from = Math.max(1, daysBetween(trip.startDate, stay.checkIn) + 1);
  const to = Math.min(count, daysBetween(trip.startDate, stay.checkOut) + 1);
  const days: number[] = [];
  for (let d = from; d <= to; d++) days.push(d);
  return days;
}

/** Where a stay Place sits on a calendar date: check-in day, a night in between, or check-out day. */
export function stayPhase(stay: Pick<PlaceStay, "checkIn" | "checkOut">, date: string): "in" | "night" | "out" | null {
  if (date === stay.checkIn) return "in";
  if (date === stay.checkOut) return "out";
  return date > stay.checkIn && date < stay.checkOut ? "night" : null;
}

/** "3 คืน" */
export function stayNights(stay: Pick<PlaceStay, "checkIn" | "checkOut">): number {
  return daysBetween(stay.checkIn, stay.checkOut);
}

/**
 * Typed tag names → tag ids, reusing tags instead of creating duplicates:
 * my own tag with that name first, then another member's tag already used in
 * the trip. Names left over must be created as the User's tags.
 */
export function resolveTagNames(
  names: readonly string[],
  myTags: readonly Pick<Tag, "id" | "name">[],
  tripTags: readonly Pick<Tag, "id" | "name">[],
): { ids: ID[]; create: string[] } {
  const ids: ID[] = [];
  const create: string[] = [];
  const find = (list: readonly Pick<Tag, "id" | "name">[], n: string) => list.find((t) => t.name.toLowerCase() === n.toLowerCase());
  for (const n of names) {
    const hit = find(myTags, n) ?? find(tripTags, n);
    if (hit) {
      if (!ids.includes(hit.id)) ids.push(hit.id);
    } else if (!create.some((c) => c.toLowerCase() === n.toLowerCase())) create.push(n);
  }
  return { ids, create };
}

export interface TagSuggestions<T> {
  mine: T[];
  others: T[];
}

/** Form suggestions: my tags first, then other tags in the trip; hides picked ones and filters by the typed text. */
export function tagSuggestions<T extends Pick<Tag, "id" | "name" | "ownerId">>(
  myUserId: ID,
  myTags: readonly T[],
  tripTags: readonly T[],
  pickedIds: readonly ID[],
  query: string,
): TagSuggestions<T> {
  const q = cleanTagName(query).toLowerCase();
  const keep = (t: T) => !pickedIds.includes(t.id) && (!q || t.name.toLowerCase().includes(q));
  const mine = myTags.filter(keep);
  const others = tripTags.filter((t) => t.ownerId !== myUserId && keep(t) && !mine.some((m) => m.name.toLowerCase() === t.name.toLowerCase()));
  return { mine, others };
}

/** Whether the typed text would create a brand-new tag (no tag in suggestions has that exact name). */
export function isNewTagName(query: string, known: readonly Pick<Tag, "name">[], pickedNames: readonly string[]): boolean {
  const q = cleanTagName(query).toLowerCase();
  if (!q) return false;
  return !known.some((t) => t.name.toLowerCase() === q) && !pickedNames.some((n) => n.toLowerCase() === q);
}

export interface AreaCount {
  area: string | null;
  count: number;
}

/** Areas of one city in first-seen order, with how many Places each has ("ไม่ระบุย่าน" = null, last). */
export function areasInCity(places: readonly Pick<Place, "city" | "area">[], city: string): AreaCount[] {
  const out: AreaCount[] = [];
  for (const p of places) {
    if (p.city !== city) continue;
    const hit = out.find((a) => a.area === p.area);
    if (hit) hit.count += 1;
    else out.push({ area: p.area, count: 1 });
  }
  return [...out.filter((a) => a.area !== null), ...out.filter((a) => a.area === null)];
}

/** "Tokyo วันที่ 1–4" from the trip's City Legs, or null. */
export function legHint(legs: readonly CityLeg[] | undefined, city: string): string | null {
  const leg = legs?.find((l) => l.city === city);
  if (!leg) return null;
  return leg.from === leg.to ? `${leg.city} วันที่ ${leg.from}` : `${leg.city} วันที่ ${leg.from}–${leg.to}`;
}

export interface TagGroupView<T> {
  /** null = ไม่มีกลุ่ม */
  group: string | null;
  tags: T[];
}

/** ManageTags: named groups in first-seen order, "ไม่มีกลุ่ม" last; empty groups dropped. */
export function groupTags<T extends Pick<Tag, "group">>(tags: readonly T[]): TagGroupView<T>[] {
  const groups: TagGroupView<T>[] = [];
  for (const t of tags) {
    const g = groups.find((x) => x.group === t.group);
    if (g) g.tags.push(t);
    else groups.push({ group: t.group, tags: [t] });
  }
  return [...groups.filter((g) => g.group !== null), ...groups.filter((g) => g.group === null)];
}

/** How many Places carry each tag. */
export function tagUsage(places: readonly Pick<Place, "tagIds">[]): Map<ID, number> {
  const counts = new Map<ID, number>();
  for (const p of places) for (const id of p.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Minimal view of a plan item the stay sync needs (a Place visit on one trip day). */
export interface StayVisit {
  id: ID;
  day: number;
  time: string | null;
  note: string;
}

/**
 * Keeps the plan in step when a hotel's stay dates change (or the stay is removed).
 *
 * Visits the stay put on the plan have no time and no note, but a visit the user
 * added by hand looks the same, so it cannot be told apart for certain. Rule:
 *  - add: every day of the new stay that has no visit of this Place yet;
 *  - remove: visits on days of the OLD stay that fall outside the new one, and only
 *    if they are still untouched (no time, no note). Days outside the old stay
 *    (manual placements) and visits the user timed or annotated are never removed.
 */
export function stayPlanSync(
  visits: readonly StayVisit[],
  oldStay: Pick<PlaceStay, "checkIn" | "checkOut"> | null | undefined,
  newStay: Pick<PlaceStay, "checkIn" | "checkOut"> | null | undefined,
  trip: Pick<Trip, "startDate" | "endDate">,
): { addDays: number[]; removeIds: ID[] } {
  const oldDays = oldStay ? stayTripDays(oldStay, trip) : [];
  const newDays = newStay ? stayTripDays(newStay, trip) : [];
  const have = new Set(visits.map((v) => v.day));
  return {
    addDays: newDays.filter((d) => !have.has(d)),
    removeIds: visits.filter((v) => oldDays.includes(v.day) && !newDays.includes(v.day) && v.time === null && !v.note.trim()).map((v) => v.id),
  };
}

/** Check-in = the plan day the user came from, check-out = next day (left empty when that is past the trip's last day). */
export function defaultStayDates(trip: Pick<Trip, "startDate" | "endDate">, fromDay: number | undefined): { checkIn: string; checkOut: string } {
  if (!fromDay || fromDay < 1) return { checkIn: "", checkOut: "" };
  const checkIn = tripDayDate(trip.startDate, fromDay);
  if (checkIn < trip.startDate || checkIn > trip.endDate) return { checkIn: "", checkOut: "" };
  const next = addDays(checkIn, 1);
  return { checkIn, checkOut: next <= trip.endDate ? next : "" };
}

/** The Expense a hotel is linked to, as far as the sync needs it. */
export interface LinkedStayExpense {
  id: ID;
  amount: number;
  splitMode: "equal" | "amount" | "shares";
  /** The viewer may edit it (owner, or the editor who created it). */
  canEdit: boolean;
}

/**
 * What to do with the linked cost when the hotel's price is saved.
 *  - null: nothing to ask (no link, price not changed, cleared, or already equal to the cost)
 *  - "update": ask, then PATCH the amount (equal split: the server re-splits among the same Members)
 *  - "manual": custom / ratio split, send the user to the expense edit page instead of guessing
 *  - "locked": the user may not edit that expense (someone else's), just tell them
 */
export function stayExpenseSync(
  prev: Pick<PlaceStay, "price"> | null | undefined,
  next: Pick<PlaceStay, "price"> | null | undefined,
  linked: LinkedStayExpense | null | undefined,
): "update" | "manual" | "locked" | null {
  if (!linked || !next?.price) return null;
  if (next.price === prev?.price || next.price === linked.amount) return null;
  if (!linked.canEdit) return "locked";
  return linked.splitMode === "equal" ? "update" : "manual";
}
