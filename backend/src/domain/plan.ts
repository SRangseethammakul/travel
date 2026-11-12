/** Plan order and City Leg rules (pure). Same rules as frontend/src/lib/plan.ts and plan-form.ts. */
import { tripDayCount } from "./trip-dates.js";

type Item =
  | { kind: "place"; day: number; time: string | null; createdAt: Date }
  | { kind: "transit"; departAt: string; createdAt: Date };

/** Trip day (1-based). A Transit has no stored day: it is the day of `departAt`. */
export function planItemDay(item: Item, startDate: string): number {
  if (item.kind === "place") return item.day;
  return tripDayCount(startDate, item.departAt.slice(0, 10));
}

/** "HH:mm" sort key; untimed items go last. */
function planItemTime(item: Item): string {
  if (item.kind === "transit") return item.departAt.slice(11, 16);
  return item.time ?? "99:99";
}

/** Day, then time (untimed last), then insertion order. Done in code because MongoDB sorts null first. */
export function sortPlanItems<T extends Item>(items: readonly T[], startDate: string): T[] {
  return items
    .map((item) => ({ item, day: planItemDay(item, startDate), time: planItemTime(item) }))
    .sort(
      (a, b) =>
        a.day - b.day || a.time.localeCompare(b.time) || a.item.createdAt.getTime() - b.item.createdAt.getTime(),
    )
    .map((x) => x.item);
}

export interface CityLeg {
  city: string;
  from: number;
  to: number;
}

/** Legs sorted by day, or a Thai error message: days inside the trip, no overlap, no repeated city. */
export function checkLegs(legs: readonly CityLeg[], dayCount: number): { ok: true; legs: CityLeg[] } | { ok: false; error: string } {
  const sorted = [...legs].sort((a, b) => a.from - b.from);
  for (const l of sorted) {
    if (l.from > l.to || l.to > dayCount) return { ok: false, error: `วันของ ${l.city} ต้องอยู่ระหว่างวันที่ 1–${dayCount}` };
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.from <= sorted[i - 1]!.to) {
      return { ok: false, error: `วันของ ${sorted[i - 1]!.city} กับ ${sorted[i]!.city} ซ้อนกัน` };
    }
  }
  if (new Set(sorted.map((l) => l.city.toLowerCase())).size !== sorted.length) return { ok: false, error: "มีเมืองซ้ำในเส้นทาง" };
  return { ok: true, legs: sorted };
}
