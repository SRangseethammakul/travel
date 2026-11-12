/**
 * SettleUp (page 12): which transfer the page shows and in what state. Pure.
 */
import type { ID } from "@/lib/api/types";
import type { TransferRow } from "@/lib/expenses";

/**
 * The transfer for `?from=&to=`, or — without params — the most useful one for
 * the Current Member: something I still have to pay, then a transfer waiting
 * for my confirmation, then one I am waiting to receive, then anything done.
 * An open (pending/sent) row wins over a confirmed one for the same pair.
 */
export function pickSettleRow(rows: readonly TransferRow[], meId: ID, pair?: { from?: string; to?: string }): TransferRow | null {
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

/** Other transfers that involve me, for the small switcher under the header. */
export function myOtherRows(rows: readonly TransferRow[], meId: ID, current: TransferRow): TransferRow[] {
  return rows.filter((r) => r !== current && r.status !== "confirmed" && (r.fromId === meId || r.toId === meId));
}
