/**
 * Whole-trip view model of the print page (SPEC "บันทึก PDF แผนการเดินทาง", ADR 0003). Pure.
 * Only plan fields are copied out: no money (stay price, costPerPerson, expenses), no photos.
 */
import type { PlaceType, PlanItem, Place, Trip, TripDocument } from "@/lib/api/types";
import { formatDayMonth, tripDayDate, type ISODate } from "@/lib/date";
import { formatDuration, transitModeLabel } from "@/lib/labels";
import { stayPhase } from "@/lib/place-form";
import { arrivalsOnDay, arrivesLaterDay, dayAreasLabel, hopText, itemsByDay, legCity, nightsLodging } from "@/lib/plan";

export interface PrintPlaceItem {
  kind: "place";
  id: string;
  /** "11:00", or null when not timed. */
  time: string | null;
  name: string;
  type: PlaceType;
  area: string | null;
  mapUrl?: string;
  /** Place note, then the item's own note (empty ones dropped). */
  notes: string[];
  /** Travel to the next item of the day; null on the last item. */
  hop: string | null;
  /** Stay details for this day: `phase` line ("เช็คอิน 15:00" / "พักต่อ" / "เช็คเอาท์ 11:00"), address, booking ref. */
  stay?: { phase?: string; address?: string; bookingRef?: string };
}

export interface PrintTransitItem {
  kind: "transit";
  id: string;
  time: string;
  mode: string;
  from: string;
  to: string;
  departTime: string;
  arriveTime: string;
  /** "ถึง ส. 12 ธ.ค." when it lands on a later date, else null. */
  arriveDate: string | null;
  duration: string | null;
  bookingRef?: string;
  seatInfo?: string;
  /** Count of attached documents; the files themselves are not linked (their URLs expire). */
  docCount: number;
  hop: string | null;
}

export type PrintItem = PrintPlaceItem | PrintTransitItem;

export interface PrintArrival {
  id: string;
  time: string;
  mode: string;
  from: string;
  to: string;
  departLabel: string;
}

export interface PrintDay {
  day: number;
  date: ISODate;
  city: string | null;
  areas: string;
  /** Where the group sleeps tonight; null on the last day or when no stay covers it. */
  nightAt: string | null;
  arrivals: PrintArrival[];
  timed: PrintItem[];
  untimed: PrintPlaceItem[];
}

/** One line saying what a stay means on this date; time shown only when set. Middle nights carry no time. */
export function stayPhaseLine(stay: Pick<NonNullable<Place["stay"]>, "checkIn" | "checkOut" | "checkInTime" | "checkOutTime">, date: string): string | undefined {
  const phase = stayPhase(stay, date);
  if (phase === "in") return stay.checkInTime ? `เช็คอิน ${stay.checkInTime}` : "เช็คอิน";
  if (phase === "out") return stay.checkOutTime ? `เช็คเอาท์ ${stay.checkOutTime}` : "เช็คเอาท์";
  if (phase === "night") return "พักต่อ";
  return undefined;
}

const clock = (item: PlanItem) => (item.kind === "transit" ? item.departAt.slice(11, 16) : item.time);

export function buildPrintPlan(
  trip: Trip,
  places: readonly Place[],
  plan: readonly PlanItem[],
  documents: readonly Pick<TripDocument, "id">[] = [],
): PrintDay[] {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const docIds = new Set(documents.map((d) => d.id));
  const nights = nightsLodging(places, trip);

  return itemsByDay(plan, trip).map((raw, i) => {
    const day = i + 1;
    // Timed first (by time, stable), untimed last: same order as the Planner.
    const ordered = raw
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => (clock(a.item) ?? "99:99").localeCompare(clock(b.item) ?? "99:99") || a.idx - b.idx)
      .map((x) => x.item);
    const city = trip.legs?.length ? legCity(trip.legs, day) : null;

    const items = ordered.flatMap((item, n): PrintItem[] => {
      const hop = n < ordered.length - 1 && item.travelToNext ? hopText(item.travelToNext) : null;
      if (item.kind === "transit") {
        return [
          {
            kind: "transit",
            id: item.id,
            time: item.departAt.slice(11, 16),
            mode: transitModeLabel[item.mode],
            from: item.fromCode ? `${item.fromText} (${item.fromCode})` : item.fromText,
            to: item.toCode ? `${item.toText} (${item.toCode})` : item.toText,
            departTime: item.departAt.slice(11, 16),
            arriveTime: item.arriveAt.slice(11, 16),
            arriveDate: arrivesLaterDay(item) ? formatDayMonth(item.arriveAt.slice(0, 10)) : null,
            duration: item.durationMinutes ? formatDuration(item.durationMinutes) : null,
            bookingRef: item.bookingRef || undefined,
            seatInfo: item.seatInfo || undefined,
            docCount: item.docIds.filter((id) => docIds.has(id)).length,
            hop,
          },
        ];
      }
      const place = placeById.get(item.placeId);
      if (!place) return [];
      const s = place.stay;
      return [
        {
          kind: "place",
          id: item.id,
          time: item.time,
          name: place.name,
          type: place.type,
          area: place.area,
          mapUrl: place.mapUrl || undefined,
          notes: [place.note, item.note].filter(Boolean),
          hop,
          stay: s ? { phase: stayPhaseLine(s, tripDayDate(trip.startDate, day)), address: s.address || undefined, bookingRef: s.bookingRef || undefined } : undefined,
        },
      ];
    });

    return {
      day,
      date: tripDayDate(trip.startDate, day),
      city,
      areas: dayAreasLabel(raw, placeById, null),
      nightAt: nights[i]?.place?.name ?? null,
      arrivals: arrivalsOnDay(plan, trip, day).map((t) => ({
        id: t.id,
        time: t.arriveAt.slice(11, 16),
        mode: transitModeLabel[t.mode],
        from: t.fromCode ?? t.fromText,
        to: t.toCode ?? t.toText,
        departLabel: `ออก ${formatDayMonth(t.departAt.slice(0, 10))} ${t.departAt.slice(11, 16)}`,
      })),
      timed: items.filter((x) => x.kind === "transit" || x.time !== null),
      untimed: items.filter((x): x is PrintPlaceItem => x.kind === "place" && x.time === null),
    };
  });
}
