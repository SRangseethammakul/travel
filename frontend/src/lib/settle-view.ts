/**
 * SettleUp (page 12): which transfer the page shows and in what state. Pure.
 */
import type { ID } from "@/lib/api/types";
import type { TransferRow } from "@/lib/expenses";
import { formatMoney, type Satang } from "@/lib/money/format";
import { parseBahtInput } from "@/lib/money/input";

/**
 * The transfer for `?from=&to=`, or — without params — the most useful one for
 * the Current Member: something I still have to pay, then a transfer waiting
 * for my confirmation, then one I am waiting to receive, then anything done.
 * An open (pending/sent) row wins over a confirmed one for the same pair.
 */
export function pickSettleRow(all: readonly TransferRow[], meId: ID, pair?: { from?: string; to?: string }): TransferRow | null {
  // A waiting remainder cannot be acted on; the page shows it under its pair's sent row.
  const rows = all.filter((r) => r.status !== "waiting");
  const open = (r: TransferRow) => r.status !== "confirmed";
  if (pair?.from && pair.to) {
    const same = rows.filter((r) => r.fromId === pair.from && r.toId === pair.to);
    return same.find(open) ?? same.at(-1) ?? null;
  }
  const order: ((r: TransferRow) => boolean)[] = [
    (r) => r.fromId === meId && open(r),
    (r) => r.toId === meId && r.status === "sent",
    (r) => r.toId === meId && r.status === "pending",
    (r) => r.fromId === meId || r.toId === meId,
  ];
  for (const test of order) {
    const hit = rows.find(test);
    if (hit) return hit;
  }
  return rows.find(open) ?? null;
}

export type SettleViewer = "payer" | "receiver" | "other";

export function settleViewer(row: Pick<TransferRow, "fromId" | "toId">, meId: ID): SettleViewer {
  if (row.fromId === meId) return "payer";
  if (row.toId === meId) return "receiver";
  return "other";
}

/** Other transfers that involve me, for the small switcher under the header (other pairs only). */
export function myOtherRows(rows: readonly TransferRow[], meId: ID, current: TransferRow): TransferRow[] {
  const samePair = (r: TransferRow) => r.fromId === current.fromId && r.toId === current.toId;
  return rows.filter((r) => !samePair(r) && (r.status === "pending" || r.status === "sent") && (r.fromId === meId || r.toId === meId));
}

/** What is left of the pair while its partial report waits for confirmation (0 when nothing). */
export function waitingAmount(rows: readonly TransferRow[], current: Pick<TransferRow, "fromId" | "toId">): Satang {
  return rows.find((r) => r.status === "waiting" && r.fromId === current.fromId && r.toId === current.toId)?.amount ?? 0;
}

/**
 * The amount the payer types on SettleUp: more than 0, at most what they still
 * owe this person (`remaining`), at most 2 decimals. Thai message when not.
 */
export function settleAmount(text: string, remaining: Satang): { amount: Satang } | { error: string } {
  const amount = parseBahtInput(text);
  if (amount === null) return { error: "ใส่ยอดเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" };
  if (amount <= 0) return { error: "ใส่ยอดที่โอน" };
  if (amount > remaining) return { error: `ยอดโอนต้องไม่เกินยอดที่ค้าง ${formatMoney(remaining)}` };
  return { amount };
}

/**
 * The transfer strip on the Expenses page: what I still have to pay (pending,
 * sent, waiting — a pair's sent row stays before its waiting row) and what
 * others reported to me that I can confirm (sent only). Confirmed rows are not listed.
 */
export function transferStrip(rows: readonly TransferRow[], meId: ID): { toPay: TransferRow[]; toConfirm: TransferRow[] } {
  return {
    toPay: rows.filter((r) => r.fromId === meId && r.status !== "confirmed"),
    toConfirm: rows.filter((r) => r.toId === meId && r.status === "sent"),
  };
}
