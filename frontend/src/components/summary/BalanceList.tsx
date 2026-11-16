"use client";

import { useId, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Money } from "@/components/ui/Money";
import type { ColorKey, ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import type { ShareLine } from "@/lib/expenses";
import { balanceLabel, type BalanceTone } from "@/lib/summary-view";

const toneClass: Record<BalanceTone, string> = { receive: "text-primary", pay: "text-danger", neutral: "text-ink-muted" };

export interface BalanceRowView {
  id: ID;
  name: string;
  color: ColorKey;
  isMe: boolean;
  paid: number;
  share: number;
  /** Net Balance (Expenses only). */
  net: number;
  /** Outstanding (Net Balance after confirmed Settlements): picks the label under the Net Balance. */
  outstanding: number;
  lines: ShareLine[];
}

/** "แต่ละคน": Net Balance per Member; tap a row to see which Shares make it up. Opens on the Current Member. */
export function BalanceList({ rows, initialOpen, solo = false }: { rows: BalanceRowView[]; initialOpen: ID | null; solo?: boolean }) {
  const [open, setOpen] = useState<ID | null>(initialOpen);
  const baseId = useId();

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((r) => {
        const isOpen = open === r.id;
        const panelId = `${baseId}-${r.id}`;
        const label = solo ? { text: "ยังไม่มีคนหาร", tone: "neutral" as const } : balanceLabel(r.net, r.outstanding);
        return (
          <li
            key={r.id}
            className={cn("overflow-hidden rounded-tile border-[1.5px] bg-surface transition-colors duration-200", isOpen ? "border-primary" : "border-surface")}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : r.id)}
              className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-3.5 text-left text-ink hover:bg-surface-alt"
            >
              <Avatar name={r.name} color={r.color} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">
                  {r.name}
                  {r.isMe ? <span className="font-normal text-ink-muted"> (คุณ)</span> : null}
                </span>
                <span className="text-xs text-ink-muted">
                  จ่ายไป <Money value={r.paid} className="font-sans" /> · ส่วนของ{r.isMe ? "คุณ" : "เขา"} <Money value={r.share} className="font-sans" />
                </span>
              </span>
              <span className={cn("flex shrink-0 flex-col items-end", toneClass[label.tone])}>
                <Money value={r.net} sign="always" className="text-base font-semibold" />
                <span className="text-xs">{label.text}</span>
              </span>
            </button>
            {isOpen ? (
              <div id={panelId} className="flex flex-col gap-1.5 pr-3.5 pb-3.5 pl-[66px]">
                {r.lines.map((l) => (
                  <div key={l.expenseId} className="flex justify-between gap-2 text-[13px]">
                    <span className="text-ink-muted">
                      {l.title}
                      {l.basis ? ` (${l.basis})` : ""}
                    </span>
                    <Money value={l.amount} className="font-sans font-medium" />
                  </div>
                ))}
                {!r.lines.length ? <p className="m-0 text-[13px] text-ink-muted">ยังไม่มีส่วนที่ต้องจ่าย</p> : null}
                <div className="flex justify-between border-t border-line-soft pt-1.5 text-[13px] font-semibold">
                  <span>รวมส่วนของ {r.name}</span>
                  <Money value={r.share} className="font-sans" />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
