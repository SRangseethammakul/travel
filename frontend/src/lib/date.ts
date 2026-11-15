/**
 * Dates in this app are calendar dates stored as ISO strings ("2026-12-12").
 * They are parsed as UTC midnight and formatted in UTC so the result never
 * shifts by a day, whatever the server or browser timezone is.
 * "Today" is taken in Asia/Bangkok.
 */

export type ISODate = string;

export const APP_TIME_ZONE = "Asia/Bangkok";
const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: ISODate): Date {
  const m = ISO_RE.exec(value);
  if (!m) throw new RangeError(`invalid ISO date: ${value}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== value) throw new RangeError(`invalid ISO date: ${value}`);
  return d;
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in Bangkok (or another IANA zone). */
export function todayISO(now: Date = new Date(), timeZone = APP_TIME_ZONE): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(date).getTime() + days * DAY_MS));
}

/** Calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

/*
 * Thai names come from fixed tables, not Intl: Node and browsers ship different
 * ICU data ("พฤหัส" vs "พฤ."), which breaks hydration of client components.
 */
const WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;
const WEEKDAY_LONG = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"] as const;
const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;

interface Parts {
  weekday: string;
  day: string;
  month: string;
  /** Buddhist era. */
  year: string;
}

function parts(date: ISODate): Parts {
  const d = parseISODate(date);
  return {
    weekday: WEEKDAY_SHORT[d.getUTCDay()],
    day: String(d.getUTCDate()),
    month: MONTH_SHORT[d.getUTCMonth()],
    year: String(d.getUTCFullYear() + 543),
  };
}

/** "ส. 12 ธ.ค. 2569" */
export function formatDate(date: ISODate): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "ส. 12" — day chips in Planner / Main. */
export function formatWeekdayDay(date: ISODate): string {
  const p = parts(date);
  return `${p.weekday} ${p.day}`;
}

/** "ส. 12 ธ.ค." */
export function formatDayMonth(date: ISODate): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "เสาร์ 12 ธ.ค." — Planner day title. */
export function formatLongDayMonth(date: ISODate): string {
  const p = parts(date);
  return `${WEEKDAY_LONG[parseISODate(date).getUTCDay()]} ${p.day} ${p.month}`;
}

/** "มิ.ย. 2569" — past trips on the Trips page. */
export function formatMonthYear(date: ISODate): string {
  const p = parts(date);
  return `${p.month} ${p.year}`;
}

/**
 * Thai Buddhist-era date range with an en dash:
 * - same month: "ส. 12 – อ. 15 ธ.ค. 2569"
 * - same year: "ส. 28 พ.ย. – อ. 1 ธ.ค. 2569"
 * - different years: "พ. 30 ธ.ค. 2569 – ส. 2 ม.ค. 2570"
 */
export function formatDateRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatDate(start);
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.month !== b.month) return `${a.weekday} ${a.day} ${a.month} – ${b.weekday} ${b.day} ${b.month} ${b.year}`;
  return `${a.weekday} ${a.day} – ${b.weekday} ${b.day} ${b.month} ${b.year}`;
}

/** Inclusive trip length: 12–15 Dec → { days: 4, nights: 3 }. */
export function tripLength(start: ISODate, end: ISODate): { days: number; nights: number } {
  const nights = daysBetween(start, end);
  if (nights < 0) throw new RangeError("end is before start");
  return { days: nights + 1, nights };
}

/** "4 วัน 3 คืน" */
export function formatTripLength(start: ISODate, end: ISODate): string {
  const { days, nights } = tripLength(start, end);
  return nights ? `${days} วัน ${nights} คืน` : `${days} วัน`;
}

export type TripPhase = "upcoming" | "ongoing" | "past";

export function tripPhase(today: ISODate, start: ISODate, end: ISODate): TripPhase {
  if (daysBetween(today, start) > 0) return "upcoming";
  if (daysBetween(end, today) > 0) return "past";
  return "ongoing";
}

/** Days left until the trip starts (0 on the first day, negative once started). */
export function daysUntil(today: ISODate, start: ISODate): number {
  return daysBetween(today, start);
}

/** Countdown label: "อีก 31 วัน" / "พรุ่งนี้" / "วันนี้" / "วันที่ 2 ของทริป" / "จบแล้ว". */
export function formatCountdown(today: ISODate, start: ISODate, end: ISODate): string {
  const phase = tripPhase(today, start, end);
  if (phase === "past") return "จบแล้ว";
  const left = daysUntil(today, start);
  if (left > 1) return `อีก ${left} วัน`;
  if (left === 1) return "พรุ่งนี้";
  if (left === 0) return "วันนี้";
  return `วันที่ ${1 - left} ของทริป`;
}

/** Date of trip day N (1-based). */
export function tripDayDate(start: ISODate, day: number): ISODate {
  return addDays(start, day - 1);
}

const stampTimeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: APP_TIME_ZONE });

/**
 * A moment in Bangkok time: "วันนี้ 21:58" / "เมื่อวาน 09:10" / "8 พ.ย. 2569 21:30".
 * Pass `now` to get the relative day words; without it the full date is used.
 */
export function formatTimestamp(timestamp: string, now?: Date): string {
  const at = new Date(timestamp);
  const time = stampTimeFmt.format(at);
  if (now) {
    const diff = daysBetween(todayISO(at), todayISO(now));
    if (diff === 0) return `วันนี้ ${time}`;
    if (diff === 1) return `เมื่อวาน ${time}`;
  }
  const p = parts(todayISO(at));
  return `${p.day} ${p.month} ${p.year} ${time}`;
}
