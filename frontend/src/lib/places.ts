/**
 * Places tab: filters (kept in searchParams), grouping and city tabs. Pure.
 * Ported from the logic in Places.dc.html / PlacesJP.dc.html.
 */
import type { CityLeg, ID, PlaceType } from "@/lib/api/types";

export type PlaceGroupBy = "area" | "type";

/** "all" = every city. Otherwise a city slug, e.g. "kyoto". */
export type CityFilter = string;

export interface PlaceFilters {
  city: CityFilter;
  /** Tag ids; a Place matches if it has any of them. */
  tags: ID[];
  unscheduled: boolean;
  group: PlaceGroupBy;
}

/** The row model the Places page works on (Place + where it is in the plan). */
export interface PlaceRow {
  id: ID;
  name: string;
  type: PlaceType;
  city: string;
  area: string | null;
  tagIds: ID[];
  /** Trip days the Place is on (empty = Unscheduled Place). */
  days: number[];
  /** Note typed on the Place; the list shows its first line. */
  note?: string;
  /** Hotel dates, shown as "เช็คอิน 12 – เช็คเอาท์ 15". */
  stay?: { checkIn: string; checkOut: string };
  /** First photo (oldest), shown as a small thumbnail. */
  photo?: { id: ID; url: string };
}

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  sight: "ที่เที่ยว",
  food: "ที่กิน",
  interest: "น่าสนใจ",
  stay: "ที่พัก",
  transit: "เดินทาง",
};

export const NO_AREA = "ไม่ระบุย่าน";

export function citySlug(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Cities of a trip: City Leg order first, then any other city in library order. */
export function tripCities(rows: readonly Pick<PlaceRow, "city">[], legs?: readonly CityLeg[]): string[] {
  const out: string[] = [];
  for (const c of [...(legs ?? []).map((l) => l.city), ...rows.map((r) => r.city)]) if (!out.includes(c)) out.push(c);
  return out;
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Filters from searchParams. With more than one city the default tab is the
 * first city (PlacesJP opens on Tokyo); "ทั้งหมด" is `city=all`.
 */
export function parsePlaceFilters(sp: SearchParams, cities: readonly string[]): PlaceFilters {
  const slugs = cities.map(citySlug);
  const rawCity = first(sp.city)?.toLowerCase();
  const multi = cities.length > 1;
  const city = !multi ? "all" : rawCity === "all" || (rawCity && slugs.includes(rawCity)) ? rawCity : slugs[0];
  const tags = (first(sp.tags) ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t, i, all) => t && all.indexOf(t) === i);
  return {
    city,
    tags,
    unscheduled: first(sp.unscheduled) === "1",
    group: first(sp.group) === "type" ? "type" : "area",
  };
}

/** Query string for the filters, leaving out defaults ("" when everything is default). */
export function placeFiltersQuery(f: PlaceFilters, cities: readonly string[]): string {
  const p = new URLSearchParams();
  const defaultCity = cities.length > 1 ? citySlug(cities[0]) : "all";
  if (f.city !== defaultCity) p.set("city", f.city);
  if (f.group !== "area") p.set("group", f.group);
  if (f.tags.length) p.set("tags", f.tags.join(","));
  if (f.unscheduled) p.set("unscheduled", "1");
  const s = p.toString().replace(/%2C/g, ",");
  return s ? `?${s}` : "";
}

export function inCity<R extends Pick<PlaceRow, "city">>(rows: readonly R[], city: CityFilter): R[] {
  return city === "all" ? [...rows] : rows.filter((r) => citySlug(r.city) === city);
}

export interface CityTab {
  value: CityFilter;
  label: string;
  count: number;
}

/** "ทั้งหมด 16 · Tokyo 9 · Kyoto 3 · Osaka 4". Empty when the trip has one city. */
export function cityTabs(rows: readonly Pick<PlaceRow, "city">[], cities: readonly string[]): CityTab[] {
  if (cities.length < 2) return [];
  return [
    { value: "all", label: "ทั้งหมด", count: rows.length },
    ...cities.map((c) => ({ value: citySlug(c), label: c, count: inCity(rows, citySlug(c)).length })),
  ];
}

export interface TagOption {
  id: ID;
  name: string;
  count: number;
}

/** Tags used by the given rows, most used first (ties keep first-seen order). */
export function tagOptions(rows: readonly Pick<PlaceRow, "tagIds">[], tagNames: ReadonlyMap<ID, string>): TagOption[] {
  const counts = new Map<ID, number>();
  for (const r of rows) for (const id of r.tagIds) if (tagNames.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ id, name: tagNames.get(id)!, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * City → "ยังไม่จัดวัน" → tags (any of) → search text (name, area or tag name;
 * the search box is temporary form state, not part of the URL).
 */
export function filterPlaces<R extends PlaceRow>(
  rows: readonly R[],
  f: PlaceFilters,
  tagNames: ReadonlyMap<ID, string> = new Map(),
  query = "",
): R[] {
  const q = query.trim().toLowerCase();
  return inCity(rows, f.city).filter((r) => {
    if (f.unscheduled && r.days.length) return false;
    if (f.tags.length && !f.tags.some((t) => r.tagIds.includes(t))) return false;
    if (!q) return true;
    const hay = [r.name, r.area ?? "", r.city, ...r.tagIds.map((id) => tagNames.get(id) ?? "")];
    return hay.some((h) => h.toLowerCase().includes(q));
  });
}

export interface PlaceGroup<R> {
  key: string;
  title: string;
  count: number;
  planned: number;
  /** Area grouping, Places without an area ("ยังไม่ได้เลือกย่าน"). */
  noArea: boolean;
  items: R[];
}

/**
 * Groups in first-seen order. By area the key is the area ("Tokyo › Shinjuku"
 * when several cities are shown together); by type it is the type label.
 */
export function groupPlaces<R extends PlaceRow>(rows: readonly R[], group: PlaceGroupBy, showCity: boolean): PlaceGroup<R>[] {
  const groups = new Map<string, PlaceGroup<R>>();
  for (const r of rows) {
    const area = r.area ?? NO_AREA;
    const key = group === "type" ? r.type : `${showCity ? r.city : ""}\u0000${r.area ?? ""}`;
    const title = group === "type" ? PLACE_TYPE_LABEL[r.type] : showCity ? `${r.city} › ${area}` : area;
    let g = groups.get(key);
    if (!g) {
      g = { key, title, count: 0, planned: 0, noArea: group === "area" && r.area === null, items: [] };
      groups.set(key, g);
    }
    g.items.push(r);
    g.count += 1;
    if (r.days.length) g.planned += 1;
  }
  return [...groups.values()];
}

/** Secondary line of a row: the type when grouped by area, the area when grouped by type. */
export function placeRowSub(r: Pick<PlaceRow, "type" | "city" | "area">, group: PlaceGroupBy, showCity: boolean): string {
  if (group === "area") return PLACE_TYPE_LABEL[r.type];
  const area = r.area ?? NO_AREA;
  return showCity ? `${r.city} › ${area}` : area;
}
