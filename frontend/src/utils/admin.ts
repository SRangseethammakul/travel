/** Pure helpers for the Admin pages (URL state, labels, number formats). */
import type { AdminTripStatus, AuthProvider } from "@/lib/api/types";
import { APP_TIME_ZONE, formatTimestamp, todayISO } from "@/lib/date";

export const ADMIN_PAGE_SIZE = 20;

type Raw = string | string[] | undefined;

/** First value of a search param. */
export function first(value: Raw): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?page=` → integer ≥ 1. */
export function parsePage(value: Raw): number {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** One of `allowed`, otherwise `fallback`. */
export function pick<T extends string>(value: Raw, allowed: readonly T[], fallback: T): T {
  const v = first(value);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** `/admin/users?q=x&page=2` — entries that are empty or undefined are left out. */
export function adminHref(path: string, params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

/** "แสดง 21–40 จาก 1,284" (page is 1-based). */
export function rangeLabel(page: number, pageSize: number, total: number, shown: number): string {
  if (total === 0 || shown === 0) return "ไม่มีรายการ";
  const from = (page - 1) * pageSize + 1;
  return `แสดง ${int(from)}–${int(from + shown - 1)} จาก ${int(total)}`;
}

export const hasNext = (page: number, pageSize: number, total: number) => page * pageSize < total;

export const providerLabel: Record<AuthProvider, string> = { google: "Google", line: "LINE" };

export const tripStatusLabel: Record<AdminTripStatus, string> = {
  upcoming: "กำลังจะไป",
  ongoing: "อยู่ระหว่างทริป",
  past: "ผ่านมาแล้ว",
};

/** First owner + " +N" (SPEC: owners column). "—" if none. */
export function ownersLabel(owners: { name: string }[]): string {
  if (owners.length === 0) return "—";
  return owners.length === 1 ? owners[0].name : `${owners[0].name} +${owners.length - 1}`;
}

/** "1,284" */
export const int = (n: number) => n.toLocaleString("en-US");

/** Percent of `part` in `total`, whole number; 0 when total is 0. */
export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** "+86 ใน 30 วัน" / "−4 จากสัปดาห์ก่อน" */
export function deltaText(current: number, previous: number, suffix: string): { text: string; down: boolean } {
  const d = current - previous;
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return { text: `${sign}${Math.abs(d)} ${suffix}`, down: d < 0 };
}

/** Bar height in percent against the peak (min 2% for non-zero values so they stay visible). */
export function barPercent(value: number, peak: number): number {
  if (value <= 0 || peak <= 0) return 0;
  return Math.max(2, Math.round((value / peak) * 100));
}

/** "ใช้ล่าสุด": relative words for recent times, Thai date otherwise. null → "—". */
export function formatSeen(timestamp: string | null, now: Date): string {
  if (!timestamp) return "—";
  const min = Math.floor((now.getTime() - new Date(timestamp).getTime()) / 60_000);
  if (min < 1) return "เมื่อกี้";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24 && todayISO(new Date(timestamp)) === todayISO(now)) return `${hr} ชม.ที่แล้ว`;
  return formatTimestamp(timestamp, now);
}

/** Time of day in Bangkok, "10:14:31". */
export function formatClock(timestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(timestamp));
}

/** "6 วัน" / "3 ชม." / "12 นาที" */
export function formatUptime(sec: number): string {
  if (sec >= 86_400) return `${Math.floor(sec / 86_400)} วัน`;
  if (sec >= 3_600) return `${Math.floor(sec / 3_600)} ชม.`;
  return `${Math.max(1, Math.floor(sec / 60))} นาที`;
}

/** Total 4xx / 5xx / requests over the hourly buckets. */
export function errorTotals(hours: { c4xx: number; c5xx: number; total: number }[]): { c4xx: number; c5xx: number; total: number } {
  return hours.reduce((a, h) => ({ c4xx: a.c4xx + h.c4xx, c5xx: a.c5xx + h.c5xx, total: a.total + h.total }), { c4xx: 0, c5xx: 0, total: 0 });
}

/** "0.4%" (one decimal, "0%" when none); null when there were no requests. */
export function errorRateLabel(errors: number, total: number): string | null {
  if (total <= 0) return null;
  const rate = (errors / total) * 100;
  return `${rate === 0 ? "0" : rate.toFixed(1)}%`;
}

const thaiDateFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE });
/** "2 ม.ค. 2569" from a timestamp (Bangkok time, Buddhist year). */
export const formatThaiDate = (timestamp: string) => thaiDateFmt.format(new Date(timestamp));

const shortDayFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
/** "28 ต.ค." from "YYYY-MM-DD". */
export const formatShortDay = (isoDate: string) => shortDayFmt.format(new Date(`${isoDate}T00:00:00Z`));
