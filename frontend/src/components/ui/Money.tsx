import { formatMoney, type SignDisplay } from "@/lib/money/format";
import { cn } from "@/lib/cn";

interface MoneyProps {
  /** Integer satang. */
  value: number;
  sign?: SignDisplay;
  /**
   * `balance`: positive = primary (ได้คืน), negative = danger (ค้างจ่าย), zero = muted.
   * `inherit` (default): use the surrounding text colour.
   */
  tone?: "inherit" | "balance";
  className?: string;
}

/** The only place money is turned into text: "฿4,800" / "฿1,212.50" / "+฿14,050". */
export function Money({ value, sign = "auto", tone = "inherit", className }: MoneyProps) {
  const toneClass =
    tone === "balance" ? (value > 0 ? "text-primary" : value < 0 ? "text-danger" : "text-ink-muted") : undefined;
  return (
    <span className={cn("font-display tabular-nums", toneClass, className)}>{formatMoney(value, { sign })}</span>
  );
}
