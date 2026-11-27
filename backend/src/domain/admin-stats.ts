/** Pure helpers for the admin dashboard. Days are Bangkok calendar days (UTC+7, no DST). */
import { todayInBangkok } from "./trip-dates.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type TripStatus = "upcoming" | "ongoing" | "past";

/** Compares ISO dates as strings; `today` is the Bangkok date. */
export function tripStatus(trip: { startDate: string; endDate: string }, today: string): TripStatus {
  if (today < trip.startDate) return "upcoming";
  if (today > trip.endDate) return "past";
  return "ongoing";
}

/** The last `n` Bangkok days ending today: their dates (oldest first) and the UTC range they cover. */
export function lastBangkokDays(now: Date, n: number) {
  const todayStart = Date.parse(`${todayInBangkok(now)}T00:00:00+07:00`);
  const start = todayStart - (n - 1) * DAY_MS;
  const dates = Array.from({ length: n }, (_, i) => todayInBangkok(new Date(start + i * DAY_MS + DAY_MS / 2)));
  return {
    dates,
    current: { from: new Date(start), to: new Date(todayStart + DAY_MS) },
    previous: { from: new Date(start - n * DAY_MS), to: new Date(start) },
  };
}

/** Rolling windows ending at `now`: the last `days` days, and the same length before that. */
export function rollingWindows(now: Date, days: number) {
  const span = days * DAY_MS;
  const from = new Date(now.getTime() - span);
  return { current: { from, to: now }, previous: { from: new Date(from.getTime() - span), to: from } };
}

/** Nearest-rank 95th percentile; null for no samples. */
export function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null;
}

/** Start of the hour containing `date`. */
export const hourStart = (date: Date): Date => new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);

/** The last 24 hour starts (oldest first), the current hour last. */
export function last24Hours(now: Date): Date[] {
  const current = hourStart(now).getTime();
  return Array.from({ length: 24 }, (_, i) => new Date(current - (23 - i) * HOUR_MS));
}
