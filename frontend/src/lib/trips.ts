/**
 * Trips page (9) helpers. Pure; money in satang.
 */
import { formatCountdown, formatDateRange, formatMonthYear, tripPhase, type ISODate } from "@/lib/date";
import type { Satang } from "@/lib/money/format";

export type TripsTab = "upcoming" | "past";

export function parseTripsTab(value: string | undefined): TripsTab {
  return value === "past" ? "past" : "upcoming";
}

/** Ongoing trips stay under "กำลังจะไป" until their last day has passed. */
export function tripTab(today: ISODate, start: ISODate, end: ISODate): TripsTab {
  return tripPhase(today, start, end) === "past" ? "past" : "upcoming";
}

export interface TripCardStatus {
  /** Pill on the cover. */
  badge: string;
  /** Date line: full range for upcoming, "มิ.ย. 2569" for past. */
  dates: string;
}

/**
 * Upcoming: the real countdown ("อีก 30 วัน", "วันที่ 2 ของทริป").
 * Past: ค้างชำระ (I owe) / รอรับคืน (I'm owed) / เคลียร์ครบแล้ว (everyone 0) /
 * ฉันเคลียร์แล้ว (me 0, others not yet). Outstanding is used, not Net Balance.
 */
export function tripCardStatus(
  today: ISODate,
  trip: { startDate: ISODate; endDate: ISODate },
  myOutstanding: Satang,
  everyoneSettled: boolean,
): TripCardStatus {
  if (tripTab(today, trip.startDate, trip.endDate) === "upcoming") {
    return { badge: formatCountdown(today, trip.startDate, trip.endDate), dates: formatDateRange(trip.startDate, trip.endDate) };
  }
  const badge = myOutstanding < 0 ? "ค้างชำระ" : myOutstanding > 0 ? "รอรับคืน" : everyoneSettled ? "เคลียร์ครบแล้ว" : "ฉันเคลียร์แล้ว";
  return { badge, dates: formatMonthYear(trip.startDate) };
}
