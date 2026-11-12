"use client";

import { useId, useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { fieldClass, pillClass } from "@/components/ui/field";
import { saveLegs } from "@/lib/api/plan-actions";
import type { CityLeg, ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { legStrip, nextFreeDays } from "@/lib/plan-form";

export interface LegView extends CityLeg {
  /** "ส. 20 – อ. 23 มี.ค." */
  dates: string;
  places: number;
  stay: string | null;
}

interface RouteEditorProps {
  tripId: ID;
  legs: LegView[];
  dayCount: number;
  /** Cities that have Places but no leg yet (suggestions). */
  otherCities: string[];
  canEdit: boolean;
}

// Leg colours in order (TripRoute mockup: blue, purple, orange), then more type colours.
const LEG_BG = ["bg-type-interest", "bg-type-transit", "bg-type-food", "bg-primary", "bg-type-stay"];
const LEG_BORDER = ["border-type-interest", "border-type-transit", "border-type-food", "border-primary", "border-type-stay"];

type Editing = { index: number | null; city: string; from: number; to: number };

/** TripRoute (16): City Legs of a multi-city trip, a day strip and the leg list. */
export function RouteEditor({ tripId, legs, dayCount, otherCities, canEdit }: RouteEditorProps) {
  const ids = useId();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const strip = legStrip(legs, dayCount);
  const colorOf = (city: string | null) => {
    const i = legs.findIndex((l) => l.city === city);
    return i < 0 ? "bg-line" : LEG_BG[i % LEG_BG.length];
  };
  const free = nextFreeDays(legs, dayCount);

  const write = (next: CityLeg[], after: () => void) =>
    startTransition(async () => {
      setError("");
      const r = await saveLegs(tripId, next);
      if (r?.error) setError(r.error);
      else after();
    });
  const plain = (l: CityLeg) => ({ city: l.city, from: l.from, to: l.to });

  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  return (
    <main className="flex flex-col gap-4 px-5 pt-2 pb-6">
      <p className="m-0 text-[13px] leading-[1.55] text-ink-subtle">
        ไม่บังคับ ใส่แล้ว Planner จะแสดงสถานที่ของเมืองที่คุณอยู่ในวันนั้นก่อน
      </p>

      <section aria-label={`ภาพรวม ${dayCount} วัน`} className="flex flex-col gap-2 rounded-tile bg-surface p-3.5">
        <ol className="m-0 grid list-none gap-[3px] p-0" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}>
          {strip.map((city, i) => (
            <li key={i} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className={cn("h-7 w-full rounded-md", colorOf(city))} />
              <span className="text-[11px] text-ink-muted">
                <span className="sr-only">วันที่ </span>
                {i + 1}
                <span className="sr-only">: {city ?? "ยังไม่ระบุเมือง"}</span>
              </span>
            </li>
          ))}
        </ol>
        {legs.length ? (
          <div className="flex flex-wrap gap-3 text-xs" aria-hidden="true">
            {legs.map((l, i) => (
              <span key={l.city} className="flex items-center gap-1">
                <span className={cn("size-2 rounded-[2px]", LEG_BG[i % LEG_BG.length])} />
                {l.city}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {legs.length ? (
        <ol className="m-0 flex list-none flex-col p-0">
          {legs.map((l, i) => (
            <li key={l.city} className="flex gap-3">
              <div aria-hidden="true" className="flex w-5 shrink-0 flex-col items-center">
                <span className={cn("mt-5 size-3.5 rounded-full border-[3px] bg-surface", LEG_BORDER[i % LEG_BORDER.length])} />
                <span className={cn("w-0.5 flex-1", i === legs.length - 1 ? "bg-transparent" : "bg-line-strong")} />
              </div>
              <article className="mb-2.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-tile bg-surface p-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 className="m-0 font-display text-[17px] font-semibold">{l.city}</h2>
                  <span className="text-[13px] text-ink-subtle">
                    {l.dates} · วัน {l.from === l.to ? l.from : `${l.from}–${l.to}`}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {l.places} ที่ในลิสต์ · ที่พัก: {l.stay ?? "ยังไม่ระบุ"}
                  </span>
                </div>
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      aria-label={`แก้วันของ ${l.city}`}
                      onClick={() => setEditing({ index: i, ...plain(l) })}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-chip border-0 bg-bg text-ink-muted hover:bg-line hover:text-ink"
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label={`ลบ ${l.city} ออกจากเส้นทาง`}
                      onClick={() => setRemoving(i)}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-chip border-0 bg-bg text-ink-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 rounded-tile bg-surface px-4 py-5 text-center text-sm text-ink-muted">ยังไม่ได้ใส่เส้นทางเมือง</p>
      )}

      {error && !editing ? (
        <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <Button
          variant="dashed"
          block
          disabled={!free}
          icon={<Icon name="plus" size={16} />}
          className="rounded-2xl text-sm"
          onClick={() => free && setEditing({ index: null, city: otherCities[0] ?? "", from: free.from, to: free.to })}
        >
          {free ? "เพิ่มเมือง" : "ทุกวันมีเมืองแล้ว"}
        </Button>
      ) : null}

      <BottomSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        caption="เส้นทางเมือง"
        title={editing?.index === null ? "เพิ่มเมือง" : `แก้วันของ ${editing?.city ?? ""}`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button
              disabled={pending || !editing?.city.trim()}
              aria-busy={pending || undefined}
              onClick={() => {
                if (!editing) return;
                const next = legs.map(plain);
                const leg = { city: editing.city, from: editing.from, to: Math.max(editing.from, editing.to) };
                if (editing.index === null) next.push(leg);
                else next[editing.index] = leg;
                write(next, () => setEditing(null));
              }}
            >
              บันทึก
            </Button>
          </div>
        }
      >
        {editing ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-city`} className="text-[13px] font-semibold">
                เมือง
              </label>
              <input id={`${ids}-city`} maxLength={40} value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="เช่น Kyoto" className={fieldClass} />
              {editing.index === null && otherCities.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {otherCities.map((c) => (
                    <button key={c} type="button" aria-pressed={editing.city === c} onClick={() => setEditing({ ...editing, city: c })} className={pillClass(editing.city === c)}>
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["from", "to"] as const).map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-${k}`} className="text-[13px] font-semibold">
                    {k === "from" ? "ตั้งแต่วันที่" : "ถึงวันที่"}
                  </label>
                  <select
                    id={`${ids}-${k}`}
                    value={editing[k]}
                    onChange={(e) => setEditing({ ...editing, [k]: Number(e.target.value) })}
                    className={cn(fieldClass, "cursor-pointer")}
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        วันที่ {d}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {error ? (
              <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={removing !== null}
        title={removing !== null ? `ลบ ${legs[removing]?.city} ออกจากเส้นทาง?` : ""}
        description="สถานที่และแผนของเมืองนี้ยังอยู่ครบ แค่ Planner จะไม่จัดลำดับตามเมืองในวันเหล่านี้"
        confirmLabel="ลบออกจากเส้นทาง"
        pending={pending}
        onConfirm={() => removing !== null && write(legs.filter((_, i) => i !== removing).map(plain), () => setRemoving(null))}
        onCancel={() => setRemoving(null)}
      />
    </main>
  );
}
