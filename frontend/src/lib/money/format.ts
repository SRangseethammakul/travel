/** Money is always an integer number of satang (1 baht = 100 satang). */
export type Satang = number;

/** U+2212 MINUS SIGN — matches the mockups ("−฿3,100"). */
export const MINUS = "−";

export type SignDisplay = "auto" | "always" | "never";

export interface FormatMoneyOptions {
  /**
   * - `auto` (default): "−" for negatives only
   * - `always`: "+" for positives, "−" for negatives, nothing for zero
   * - `never`: absolute value
   */
  sign?: SignDisplay;
}

const groupFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function assertSatang(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of satang, got ${value}`);
  }
}

/**
 * Satang → "฿4,800" or "฿1,212.50" (decimals only when there are satang).
 */
export function formatMoney(satang: Satang, options: FormatMoneyOptions = {}): string {
  assertSatang(satang);
  const sign = options.sign ?? "auto";
  const abs = Math.abs(satang);
  const baht = Math.trunc(abs / 100);
  const rest = abs % 100;
  const body = `฿${groupFormatter.format(baht)}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;

  if (sign === "never" || satang === 0) return body;
  if (satang < 0) return `${MINUS}${body}`;
  return sign === "always" ? `+${body}` : body;
}

/** Whole baht → satang. Only for literals in seed data and tests. */
export function baht(value: number): Satang {
  const satang = Math.round(value * 100);
  assertSatang(satang);
  return satang;
}
