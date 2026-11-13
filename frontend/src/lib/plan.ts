/**
 * Plan helpers shared by the trip page (Main) and the Planner (pure).
 * Plan Items arrive already sorted by day then time (lib/api getPlanItems).
 */
import type { CityLeg, Hop, ID, Place, PlanItem, TransitPlanItem, Trip } from "@/lib/api/types";
import { daysBetween, tripLength, tripPhase, type ISODate } from "@/lib/date";
import { hopModeLabel } from "@/lib/labels";

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

/** Days (sorted, unique) each Place appears on, as a visit or as a transit endpoint. */
export function placeDays(items: readonly PlanItem[], trip: Pick<Trip, "startDate">): Map<ID, number[]> {
  const map = new Map<ID, Set<number>>();
  const add = (id: ID | undefined, day: number) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, new Set());
    map.get(id)!.add(day);
  };
  for (const item of items) {
    const day = itemDay(item, trip);
    if (item.kind === "place") add(item.placeId, day);
    else {
      add(item.fromPlaceId, day);
      add(item.toPlaceId, day);
    }
  }
  return new Map([...map].map(([id, days]) => [id, [...days].sort((a, b) => a - b)]));
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

/** Day card caption on the trip page: "3 ที่", last day with a flight home → "เดินทางกลับ". */
export function dayCardCaption(dayItems: readonly PlanItem[], day: number, dayCount: number): string {
  if (day === dayCount && dayCount > 1 && dayItems.some((i) => i.kind === "transit")) return "เดินทางกลับ";
  return dayItems.length ? `${dayItems.length} ที่` : "ยังว่าง";
}

/** Hop chip text: "รถไฟ · ~40 นาที · ไปชินจูกุ". */
export function hopText(hop: Hop): string {
  return [hopModeLabel[hop.mode], hop.minutes ? `~${hop.minutes} นาที` : null, hop.note || null].filter(Boolean).join(" · ");
}

