/**
 * AddPlace (pages 8 / 15) and ManageTags (page 17) helpers. Pure.
 */
import type { CityLeg, ID, Place, PlaceType, Tag } from "@/lib/api/types";

export const PLACE_TYPES: readonly PlaceType[] = ["sight", "food", "interest", "stay", "transit"];
export const MAX_PLACE_NAME = 80;
export const MAX_NOTE = 500;
export const MAX_TAG_NAME = 30;
export const MAX_TAGS = 10;

export interface PlaceDraft {
  name: string;
  mapUrl: string;
  type: PlaceType;
  city: string;
  /** "" = ไม่ระบุย่าน */
  area: string;
  /** Existing tag ids picked from suggestions. */
  tagIds: ID[];
  /** Tags typed by the user that do not exist yet (or might, by name). */
  newTagNames: string[];
  note: string;
}

export type PlaceDraftResult =
  | { ok: true; name: string; mapUrl?: string; city: string; area: string | null; note: string; tagIds: ID[]; newTagNames: string[] }
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
  if (!PLACE_TYPES.includes(draft.type)) return { ok: false, error: "เลือกประเภท" };
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

  return { ok: true, name, ...(mapUrl ? { mapUrl } : {}), city, area: area || null, note, tagIds, newTagNames };
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
