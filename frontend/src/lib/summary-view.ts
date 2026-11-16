/**
 * Summary (page 5) "แต่ละคน": the words under a Member's Net Balance. Pure.
 */
import { formatMoney, type Satang } from "@/lib/money/format";

export type BalanceTone = "receive" | "pay" | "neutral";

/**
 * The row still shows the Net Balance (CONTEXT), but the label follows
 * Outstanding so a settled Member is never told to pay more:
 * - nothing confirmed yet (Outstanding = Net) → "ได้คืน" / "ต้องจ่ายเพิ่ม"
 * - partly settled → "ค้างจ่ายอีก ฿x" / "รอรับคืนอีก ฿x"
 * - Outstanding 0 → "เคลียร์แล้ว" ("พอดี" when the Net Balance is 0 too)
 */
export function balanceLabel(net: Satang, outstanding: Satang): { text: string; tone: BalanceTone } {
  if (outstanding === 0) return { text: net === 0 ? "พอดี" : "เคลียร์แล้ว", tone: "neutral" };
  const tone: BalanceTone = outstanding > 0 ? "receive" : "pay";
  if (outstanding === net) return { text: outstanding > 0 ? "ได้คืน" : "ต้องจ่ายเพิ่ม", tone };
  const left = formatMoney(Math.abs(outstanding));
  return { text: outstanding > 0 ? `รอรับคืนอีก ${left}` : `ค้างจ่ายอีก ${left}`, tone };
}
