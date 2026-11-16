"use client";

import { useId, useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { fieldClass, fieldLabelClass } from "@/components/ui/field";
import { removePlanItemAction, updateVisitAction } from "@/lib/api/plan-actions";
import type { ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export interface PlaceMenuProps {
  tripId: ID;
  itemId: ID;
  name: string;
  day: number;
  time: string | null;
  note: string;
  /** A hotel's days follow its stay dates, so its day is not editable here. */
  isStay: boolean;
  days: { day: number; sub: string }[];
  /** Days this Place is already on (it cannot be moved onto one of them). */
  taken: number[];
}

const row = "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-icon border-0 bg-bg px-4 text-left text-[15px] font-semibold text-ink hover:bg-line-soft";

/** ⋯ on a place card (above the full-card link): edit time / note / day, or take it off the plan. */
export function PlaceMenu({ tripId, itemId, name, day, time, note, isStay, days, taken }: PlaceMenuProps) {
  const ids = useId();
  const [sheet, setSheet] = useState<"menu" | "edit" | "remove" | null>(null);
  const [draftTime, setDraftTime] = useState(time ?? "");
  const [draftNote, setDraftNote] = useState(note);
  const [draftDay, setDraftDay] = useState(day);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const open = (next: "menu" | "edit" | "remove") => {
    if (next === "edit") {
      setDraftTime(time ?? "");
      setDraftNote(note);
      setDraftDay(day);
    }
    setError("");
    setSheet(next);
  };
  const run = (job: () => Promise<{ error?: string } | null>) =>
    startTransition(async () => {
      setError("");
      const r = await job();
      if (r?.error) setError(r.error);
      else setSheet(null);
    });
  const save = () => run(() => updateVisitAction(tripId, itemId, day, { day: isStay ? null : draftDay, time: draftTime, note: draftNote }));

  return (
    <>
      <button
        type="button"
        aria-label={`ตัวเลือกของ ${name}`}
        aria-haspopup="dialog"
        onClick={() => open("menu")}
        className="relative z-10 -my-2 -mr-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border-0 bg-transparent text-ink-subtle hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="more" size={18} />
      </button>

      <BottomSheet open={sheet === "menu"} onClose={() => setSheet(null)} caption="สถานที่ในแผน" title={name}>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => open("edit")} className={row} data-autofocus>
            <Icon name="clock" size={18} />
            แก้เวลา / โน้ต / วัน
          </button>
          <button type="button" onClick={() => open("remove")} className={cn(row, "text-danger")}>
            <Icon name="trash" size={18} />
            เอาออกจากแผน
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "edit"}
        onClose={() => setSheet(null)}
        caption="แก้ในแผน"
        title={name}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => setSheet(null)}>
              ยกเลิก
            </Button>
            <Button disabled={pending} aria-busy={pending || undefined} onClick={save}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-time`} className={fieldLabelClass}>
            เวลา (ไม่บังคับ)
          </label>
          <div className="flex gap-2">
            <input id={`${ids}-time`} type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className={cn(fieldClass, "min-w-0 flex-1")} data-autofocus />
            {draftTime ? (
              <Button variant="secondary" disabled={pending} onClick={() => setDraftTime("")}>
                ล้างเวลา
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-note`} className={fieldLabelClass}>
            โน้ต
          </label>
          <input id={`${ids}-note`} type="text" maxLength={200} placeholder="เช่น จองคิวไว้แล้ว" value={draftNote} onChange={(e) => setDraftNote(e.target.value)} className={fieldClass} />
        </div>
        {isStay ? (
          <p className="m-0 text-[13px] text-ink-muted">วันของที่พักตามวันเช็คอิน–เช็คเอาท์ ถ้าจะย้ายให้แก้ที่หน้าที่พัก</p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className={cn(fieldLabelClass, "mb-2 p-0")}>ย้ายไปวัน</legend>
            <div role="radiogroup" aria-label="ย้ายไปวัน" className={cn("grid gap-1.5", days.length > 4 ? "grid-cols-5" : "grid-cols-4")}>
              {days.map((d) => {
                const blocked = d.day !== day && taken.includes(d.day);
                const on = draftDay === d.day;
                return (
                  <button
                    key={d.day}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={blocked || undefined}
                    title={blocked ? "สถานที่นี้อยู่ในวันนี้แล้ว" : undefined}
                    onClick={() => !blocked && setDraftDay(d.day)}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-col items-center justify-center gap-px rounded-chip border-[1.5px] transition-colors duration-150",
                      blocked ? "cursor-not-allowed border-line bg-bg text-ink-muted" : on ? "border-primary bg-primary text-surface" : "border-line bg-surface text-ink hover:border-line-strong",
                    )}
                  >
                    <span className="text-[11px] opacity-85">{blocked ? "มีแล้ว" : d.sub}</span>
                    <span className="text-[13px] font-semibold">วัน {d.day}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={sheet === "remove"}
        title={`เอา ${name} ออกจากแผนวันนี้?`}
        description={error || "สถานที่ยังอยู่ในรายการสถานที่ของทริป แค่ไม่อยู่ในแผนของวันนี้"}
        confirmLabel="เอาออกจากแผน"
        pending={pending}
        onConfirm={() => run(() => removePlanItemAction(tripId, itemId))}
        onCancel={() => setSheet(null)}
      />
    </>
  );
}
