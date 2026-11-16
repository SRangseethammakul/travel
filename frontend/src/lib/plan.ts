/**
 * Plan helpers shared by the trip page (Main) and the Planner (pure).
 * Plan Items arrive already sorted by day then time (lib/api getPlanItems).
 */
import type { CityLeg, Hop, ID, Place, PlanItem, TransitPlanItem, Trip } from "@/lib/api/types";
import { addDays, daysBetween, formatDayMonth, tripLength, tripPhase, type ISODate } from "@/lib/date";
import { hopModeLabel, transitModeLabel } from "@/lib/labels";

type TripDates = Pick<Trip, "startDate" | "endDate">;

/** Trip day (1-based) a Plan Item belongs to. Transit days come from the departure date. */
export function itemDay(item: PlanItem, trip: Pick<Trip, "startDate">): number {
  if (item.kind === "place") return item.day;
  return daysBetween(trip.startDate, item.departAt.slice(0, 10)) + 1;
}

export function tripDayCount(trip: TripDates): number {
  return tripLength(trip.startDate, trip.endDate).days;
}

/** Items for each trip day 1..N (days outside the trip are dropped). */
export function itemsByDay(items: readonly PlanItem[], trip: TripDates): PlanItem[][] {
  const days: PlanItem[][] = Array.from({ length: tripDayCount(trip) }, () => []);
  for (const item of items) days[itemDay(item, trip) - 1]?.push(item);
  return days;
}

/** True when a Transit lands on a later date than it leaves (overnight flight). */
export function arrivesLaterDay(item: Pick<TransitPlanItem, "departAt" | "arriveAt">): boolean {
  return item.arriveAt.slice(0, 10) > item.departAt.slice(0, 10);
}

/** Overnight Transits that land on trip day `day` (they are listed on their departure day). */
export function arrivalsOnDay(items: readonly PlanItem[], trip: Pick<Trip, "startDate">, day: number): TransitPlanItem[] {
  return items.filter(
    (i): i is TransitPlanItem =>
      i.kind === "transit" && arrivesLaterDay(i) && daysBetween(trip.startDate, i.arriveAt.slice(0, 10)) + 1 === day,
  );
}

/** Days (sorted, unique) each Place appears on, as a visit or as a transit endpoint. Derived from placeVisits so both always agree. */
export function placeDays(items: readonly PlanItem[], trip: Pick<Trip, "startDate">): Map<ID, number[]> {
  return new Map([...placeVisits(items, trip)].map(([id, visits]) => [id, [...new Set(visits.map((v) => v.day))]]));
}

/** Unscheduled Places: no Plan Item yet (library order kept). */
export function unscheduledPlaces<P extends Pick<Place, "id">>(places: readonly P[], items: readonly PlanItem[], trip: Pick<Trip, "startDate">): P[] {
  const days = placeDays(items, trip);
  return places.filter((p) => !days.has(p.id));
}

/** City of a trip day from its City Legs, if any. */
export function legCity(legs: readonly CityLeg[] | undefined, day: number): string | null {
  return legs?.find((l) => day >= l.from && day <= l.to)?.city ?? null;
}

/**
 * Day header line: distinct areas of the day's Place items, in order
 * ("Asakusa · Akihabara"). Multi-city trips lead with the leg's city.
 */
export function dayAreasLabel(
  dayItems: readonly PlanItem[],
  placesById: ReadonlyMap<ID, Pick<Place, "area">>,
  city: string | null = null,
): string {
  const areas: string[] = [];
  for (const item of dayItems) {
    if (item.kind !== "place") continue;
    const area = placesById.get(item.placeId)?.area;
    if (area && !areas.includes(area)) areas.push(area);
  }
  if (!city) return areas.join(" · ");
  return areas.length ? `${city} › ${areas.join(" · ")}` : city;
}

/** Day the Planner opens on: `?day=` if valid, else today's trip day while travelling, else day 1. */
export function resolveDay(param: string | string[] | undefined, trip: TripDates, today: ISODate): number {
  const count = tripDayCount(trip);
  const n = Number(Array.isArray(param) ? param[0] : param);
  if (Number.isInteger(n) && n >= 1 && n <= count) return n;
  if (tripPhase(today, trip.startDate, trip.endDate) === "ongoing") return daysBetween(trip.startDate, today) + 1;
  return 1;
}

/**
 * Day card caption on the trip page: "3 ที่", last day with a flight home → "เดินทางกลับ".
 * Counts Places, not Plan Items: a Transit counts only through a Place it is linked to
 * (Tokyo day 1: Haneda + 2 visits = "3 ที่"). A day with only unlinked Transit is
 * "เดินทางไป" on day 1, else "วันเดินทาง".
 */
export function dayCardCaption(dayItems: readonly PlanItem[], day: number, dayCount: number): string {
  const hasTransit = dayItems.some((i) => i.kind === "transit");
  if (day === dayCount && dayCount > 1 && hasTransit) return "เดินทางกลับ";
  const placeIds = new Set(
    dayItems.flatMap((i) => (i.kind === "place" ? [i.placeId] : [i.fromPlaceId, i.toPlaceId].filter((id): id is string => Boolean(id)))),
  );
  if (placeIds.size) return `${placeIds.size} ที่`;
  if (hasTransit) return day === 1 ? "เดินทางไป" : "วันเดินทาง";
  return "ยังว่าง";
}

/** Hop chip text: "รถไฟ · ~40 นาที · ไปชินจูกุ". */
export function hopText(hop: Hop): string {
  return [hopModeLabel[hop.mode], hop.minutes ? `~${hop.minutes} นาที` : null, hop.note || null].filter(Boolean).join(" · ");
}


export interface LodgingNight {
  /** 1-based night: night 1 is the night after trip day 1. */
  night: number;
  date: ISODate;
  place: Place | null;
}

/** Where the group sleeps each night (check-in ≤ night < check-out). A trip of N days has N−1 nights. */
export function nightsLodging(places: readonly Place[], trip: Pick<Trip, "startDate" | "endDate">): LodgingNight[] {
  const stays = places.filter((p) => p.type === "stay" && p.stay);
  const nights = Math.max(0, tripDayCount(trip) - 1);
  return Array.from({ length: nights }, (_, i) => {
    const date = addDays(trip.startDate, i);
    const place = stays.find((p) => p.stay && p.stay.checkIn <= date && date < p.stay.checkOut) ?? null;
    return { night: i + 1, date, place };
  });
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Gentle warnings when hotel dates and transit don't line up (Thai text). Only fires when the data can tell:
 * - two stays share a night, or a night between two stays has no hotel;
 * - checking in to a stay in another city on day N, while the transit into that city (matched by the
 *   transit's place city or its destination text) is on a different day.
 * Nothing is said when the city or the transit can't be matched.
 */
export function stayTransitWarnings(places: readonly Place[], plan: readonly PlanItem[], trip: Pick<Trip, "startDate">): string[] {
  const stays = places
    .filter((p): p is Place & { stay: NonNullable<Place["stay"]> } => p.type === "stay" && !!p.stay)
    .sort((a, b) => a.stay.checkIn.localeCompare(b.stay.checkIn));
  const dayOf = (date: ISODate) => daysBetween(trip.startDate, date) + 1;
  const byId = new Map(places.map((p) => [p.id, p]));
  const transits = plan.filter((i): i is TransitPlanItem => i.kind === "transit");
  const out: string[] = [];

  for (let i = 1; i < stays.length; i++) {
    const a = stays[i - 1];
    const b = stays[i];
    if (a.stay.checkOut > b.stay.checkIn) {
      out.push(`${a.name} กับ ${b.name} ซ้อนกัน คืนวันที่ ${dayOf(b.stay.checkIn)} มีที่พักสองที่`);
    } else if (a.stay.checkOut < b.stay.checkIn) {
      const from = dayOf(a.stay.checkOut);
      const to = dayOf(b.stay.checkIn) - 1;
      out.push(`คืนวันที่ ${from === to ? from : `${from}–${to}`} ยังไม่มีที่พัก (ระหว่าง ${a.name} กับ ${b.name})`);
    }

    const city = norm(b.city);
    if (!city || city === norm(a.city)) continue;
    const toCity = (t: TransitPlanItem) => {
      const placeCity = t.toPlaceId ? norm(byId.get(t.toPlaceId)?.city) : "";
      if (placeCity) return placeCity === city;
      const text = norm(t.toText);
      return !!text && (text.includes(city) || city.includes(text));
    };
    const candidates = transits.filter((t) => toCity(t) && t.arriveAt.slice(0, 10) >= a.stay.checkIn && t.departAt.slice(0, 10) < b.stay.checkOut);
    if (!candidates.length) continue;
    if (candidates.some((t) => t.departAt.slice(0, 10) === b.stay.checkIn || t.arriveAt.slice(0, 10) === b.stay.checkIn)) continue;
    const gap = (t: TransitPlanItem) => Math.abs(daysBetween(b.stay.checkIn, t.departAt.slice(0, 10)));
    const t = candidates.reduce((best, c) => (gap(c) < gap(best) ? c : best));
    out.push(`เช็คอิน ${b.name} วันที่ ${dayOf(b.stay.checkIn)} แต่เดินทางเข้า${b.city}วันที่ ${dayOf(t.departAt.slice(0, 10))}`);
  }
  return out;
}

export interface PlaceVisit {
  day: number;
  /** "19:00", or null when not timed yet. */
  time: string | null;
  /** Set for a transit endpoint: "บินออก (เครื่องบิน → NRT)" / "ถึง (เครื่องบิน จาก BKK)". */
  label?: string;
}

/**
 * Every appearance of each Place in the plan, by day then time (untimed last): place visits plus
 * transit endpoints (leaving from / arriving at). The one source for the Places list and the detail.
 * A transit leaves on its departure day and arrives on its arrival day (later for overnight).
 */
export function placeVisits(items: readonly PlanItem[], trip: Pick<Trip, "startDate">): Map<ID, PlaceVisit[]> {
  const map = new Map<ID, PlaceVisit[]>();
  const add = (id: ID | undefined, visit: PlaceVisit) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(visit);
  };
  for (const item of items) {
    if (item.kind === "place") {
      add(item.placeId, { day: item.day, time: item.time });
      continue;
    }
    const mode = transitModeLabel[item.mode];
    add(item.fromPlaceId, {
      day: itemDay(item, trip),
      time: item.departAt.slice(11, 16),
      label: `ออกเดินทาง (${mode} → ${item.toCode ?? item.toText})`,
    });
    add(item.toPlaceId, {
      day: daysBetween(trip.startDate, item.arriveAt.slice(0, 10)) + 1,
      time: item.arriveAt.slice(11, 16),
      label: `ถึง (${mode} จาก ${item.fromCode ?? item.fromText})`,
    });
  }
  for (const list of map.values()) list.sort((a, b) => a.day - b.day || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  return map;
}

/** "วัน 2 · ศ. 18 ธ.ค. · 19:00" / "… · ยังไม่ระบุเวลา"; transit endpoints add their label. */
export function formatVisitLine(visit: PlaceVisit, startDate: ISODate): string {
  const line = `วัน ${visit.day} · ${formatDayMonth(addDays(startDate, visit.day - 1))} · ${visit.time ?? "ยังไม่ระบุเวลา"}`;
  return visit.label ? `${line} · ${visit.label}` : line;
}
