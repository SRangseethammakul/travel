"use client";

import { useId, useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { pillClass } from "@/components/ui/field";
import { saveHop } from "@/lib/api/plan-actions";
import type { Hop, HopMode, ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { hopModeLabel } from "@/lib/labels";
import { hopText } from "@/lib/plan";
import { HOP_MODES } from "@/lib/plan-form";

interface HopButtonProps {
  tripId: ID;
  itemId: ID;
  hop: Hop | undefined;
  /** "Tokyo Skytree → ชาบูบุฟเฟ่ต์" */
  title: string;
}

const small = "h-11 min-w-0 rounded-chip border border-line-strong bg-surface px-3 text-[15px] text-ink";

/** Hop chip between two Plan Items; opens the travel sheet (Planner mockup). */
export function HopButton({ tripId, itemId, hop, title }: HopButtonProps) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<HopMode>(hop?.mode ?? "train");
  const [minutes, setMinutes] = useState(hop?.minutes ? String(hop.minutes) : "");
  const [note, setNote] = useState(hop?.note ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    setMode(hop?.mode ?? "train");
    setMinutes(hop?.minutes ? String(hop.minutes) : "");
    setNote(hop?.note ?? "");
    setError("");
    setOpen(true);
  };
  const write = (input: { mode: string; minutes: string; note: string } | null) =>
    startTransition(async () => {
      setError("");
      const r = await saveHop(tripId, itemId, input);
      if (r?.error) setError(r.error);
      else setOpen(false);
    });

  return (
    <>
      {hop ? (
        <button
          type="button"
          onClick={openSheet}
          aria-label={`แก้การเดินทางไปรายการถัดไป: ${hopText(hop)}`}
          className="mt-1.5 mb-0.5 inline-flex min-h-9 cursor-pointer items-center gap-1.5 self-start rounded-[10px] border-0 bg-interest-soft px-2.5 text-xs font-semibold text-interest-ink hover:bg-interest-soft/70"
        >
          <Icon name="route" size={14} />
          {hopText(hop)}
        </button>
      ) : (
        <button
          type="button"
          onClick={openSheet}
          className="mt-1.5 mb-0.5 inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-[10px] border-[1.5px] border-dashed border-control bg-transparent px-2.5 text-xs font-semibold text-ink-soft hover:border-ink-muted"
        >
          <Icon name="plus" size={12} />
          เพิ่มการเดินทาง
        </button>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        caption="การเดินทาง"
        title={title}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant={hop ? "danger-outline" : "secondary"} disabled={pending} onClick={() => (hop ? write(null) : setOpen(false))}>
              {hop ? "ลบการเดินทาง" : "ยกเลิก"}
            </Button>
            <Button disabled={pending} aria-busy={pending || undefined} onClick={() => write({ mode, minutes, note })}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        }
      >
        <div role="radiogroup" aria-label="วิธีเดินทาง" className="flex flex-wrap gap-2">
          {HOP_MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={pillClass(mode === m)} data-autofocus={mode === m || undefined}>
              {hopModeLabel[m]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-min`} className="text-xs font-semibold text-ink-muted">
              นาที (โดยประมาณ)
            </label>
            <input id={`${ids}-min`} type="text" inputMode="numeric" maxLength={4} placeholder="15" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className={small} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-note`} className="text-xs font-semibold text-ink-muted">
              โน้ต เช่น สายรถไฟ ทางออก
            </label>
            <input id={`${ids}-note`} type="text" maxLength={80} placeholder="JR Yamanote ไป Shibuya" value={note} onChange={(e) => setNote(e.target.value)} className={cn(small)} />
          </div>
        </div>
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
      </BottomSheet>
    </>
  );
}
