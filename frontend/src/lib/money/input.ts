/**
 * Money typed by people ("1,212.50") ↔ integer satang. Pure, safe for client components.
 * `baht()` in format.ts is only for literals in seed data and tests.
 */
import type { Satang } from "./format";

const groupFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Keep what a money field may contain while typing: digits with thousands
 * separators and at most 2 decimals. "4800" → "4,800", "1212.5" → "1,212.5",
 * "12.345" → "12.34", "abc" → "".
 */
export function formatBahtInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  const [intRaw, ...rest] = cleaned.split(".");
  const intDigits = intRaw.replace(/^0+(?=\d)/, "");
  const intPart = intDigits ? groupFormatter.format(Number(intDigits.slice(0, 12))) : rest.length ? "0" : "";
  if (!rest.length) return intPart;
  return `${intPart}.${rest.join("").slice(0, 2)}`;
}

/**
 * "1,212.50" → 121250. Empty → 0. Returns null when the text is not a valid
 * baht amount (letters, more than 2 decimals, too large).
 */
export function parseBahtInput(text: string): Satang | null {
  const value = text.replace(/,/g, "").trim();
  if (!value) return 0;
  const m = /^(\d{0,12})(?:\.(\d{0,2}))?$/.exec(value);
  if (!m || (!m[1] && !m[2])) return null;
  const whole = Number(m[1] || "0");
  const fraction = Number((m[2] ?? "").padEnd(2, "0"));
  const satang = whole * 100 + fraction;
  return Number.isSafeInteger(satang) ? satang : null;
}

/** Satang → text for a money field: 121250 → "1,212.50", 480000 → "4,800", 0 → "". */
export function satangToInput(satang: Satang): string {
  if (!satang) return "";
  const whole = Math.trunc(satang / 100);
  const rest = satang % 100;
  return `${groupFormatter.format(whole)}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}
