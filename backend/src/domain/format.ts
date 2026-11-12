/** Satang → "฿4,800" or "฿1,212.50" (decimals only when there are satang). For Activity text. */
export function formatBaht(satang: number): string {
  const sign = satang < 0 ? "−" : "";
  const abs = Math.abs(satang);
  const baht = Math.trunc(abs / 100).toLocaleString("en-US");
  const rest = abs % 100;
  return `${sign}฿${baht}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}
