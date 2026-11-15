"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { placeTypeStyle } from "@/components/ui/colors";
import { addToPlan } from "@/lib/api/plan-actions";
import type { ID, PlaceType } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export interface PickRowView {
  id: ID;
  name: string;
  type: PlaceType;
  area: string | null;
  city: string;
  tags: string[];
  days: number[];
}

export interface PickSectionView {
  key: string;
  title: string;
  sub: string;
  rows: PickRowView[];
}

interface PickPlaceFormProps {
  tripId: ID;
  sections: PickSectionView[];
  /** Day chips: "วัน 2" over "อา. 13". */
  days: { day: number; sub: string }[];
  initialDay: number;
  initialPlaceId: ID | null;
  /** Show the city in row meta (multi-city trips). */
  showCity: boolean;
  newPlaceHref: string;
}

/** PickPlace (13): choose a Place from the trip's list, a time, and one or more days. */
export function PickPlaceForm({ tripId, sections, days, initialDay, initialPlaceId, showCity, newPlaceHref }: PickPlaceFormProps) {
  const ids = useId();
  const all = sections.flatMap((s) => s.rows);
  const [selId, setSelId] = useState<ID | null>(all.some((r) => r.id === initialPlaceId) ? initialPlaceId : null);
  const [time, setTime] = useState("");
  const [picked, setPicked] = useState<number[]>([initialDay]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const match = (r: PickRowView) => !q || [r.name, r.area ?? "", r.city, ...r.tags].some((h) => h.toLowerCase().includes(q));
  const visible = sections.map((s) => ({ ...s, rows: s.rows.filter(match) })).filter((s) => s.rows.length);
  const chosen = all.find((r) => r.id === selId);
  // Days that already have the chosen Place cannot be picked again.
  const taken = new Set(chosen?.days ?? []);
  const dayList = picked.filter((d) => !taken.has(d));
  const ok = !!chosen && dayList.length > 0 && !pending;

  const save = () => {
    if (!ok || !chosen) return;
    setError("");
    startTransition(async () => {
      const r = await addToPlan(tripId, { placeId: chosen.id, days: dayList, time, note: "" });
      if (r?.error) setError(r.error);
    });
  };

  return (
    <>
      <div className="px-5 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-icon bg-bg px-3.5 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          <Icon name="search" size={18} />
          <span className="sr-only">ค้นหาสถานที่ในทริป</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ ย่าน หรือ tag"
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none"
          />
        </label>
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-4">
        {visible.map((s) => (
          <section key={s.key} className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id={`${ids}-${s.key}`} className="m-0 text-sm font-semibold">
                {s.title}
              </h2>
              <span className="text-xs text-ink-muted">{s.sub}</span>
            </div>
            <div role="radiogroup" aria-labelledby={`${ids}-${s.key}`} className="flex flex-col gap-2">
              {s.rows.map((r) => {
                const on = r.id === selId;
                const style = placeTypeStyle[r.type];
                const meta = [style.label, showCity ? `${r.city} › ${r.area ?? "ไม่ระบุย่าน"}` : (r.area ?? "ไม่ระบุย่าน"), r.tags.map((t) => `#${t}`).join(" ")]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelId(r.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] p-3 text-left text-ink transition-colors duration-150",
                      on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    <span aria-hidden="true" className={cn("w-1.5 shrink-0 self-stretch rounded-full", style.bar)} />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-[15px] font-semibold">{r.name}</span>
                      <span className="text-xs text-ink-subtle">{meta}</span>
                      <span className={cn("text-xs", r.days.length ? "text-ink-muted" : "text-todo")}>
                        {r.days.length ? `อยู่ในแผน: ${r.days.map((d) => `วัน ${d}`).join(" · ")}` : "ยังไม่จัดวัน"}
                      </span>
                    </span>
                    <span aria-hidden="true" className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-disabled")}>
                      {on ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!visible.length ? (
          <p className="m-0 rounded-2xl bg-bg px-4 py-5 text-center text-sm text-ink-muted">
            {q ? `ไม่พบ "${query.trim()}" ในลิสต์ของทริป` : "ทุกที่ในลิสต์อยู่ในวันนี้แล้ว"}
          </p>
        ) : null}
        <Link href={newPlaceHref} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-control text-sm font-medium text-ink no-underline hover:border-ink-muted hover:text-ink">
          <Icon name="plus" size={16} />
          ไม่มีในลิสต์? สร้างสถานที่ใหม่
        </Link>
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-line bg-surface px-5 pt-3.5 pb-[calc(28px+env(safe-area-inset-bottom))] shadow-sheet">
        <div className="flex items-center gap-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-ink-muted">ที่เลือก</span>
            <span className="truncate text-[15px] font-semibold">{chosen?.name ?? "ยังไม่ได้เลือก"}</span>
          </span>
          <label htmlFor={`${ids}-time`} className="sr-only">
            เวลา (ไม่บังคับ)
          </label>
          <input
            id={`${ids}-time`}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-11 w-[120px] rounded-chip border border-line-strong bg-surface px-2.5 text-base text-ink"
          />
        </div>
        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold">เพิ่มลงวันไหนบ้าง (เลือกได้หลายวัน)</legend>
          <div className={cn("grid gap-1.5", days.length > 4 ? "grid-cols-5" : "grid-cols-4")}>
            {days.map((d) => {
              const already = taken.has(d.day);
              const on = picked.includes(d.day) && !already;
              return (
                <button
                  key={d.day}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-disabled={already || undefined}
                  title={already ? "อยู่ในวันนี้แล้ว" : undefined}
                  onClick={() => !already && setPicked(on ? picked.filter((x) => x !== d.day) : [...picked, d.day])}
                  className={cn(
                    "flex min-h-12 cursor-pointer flex-col items-center justify-center gap-px rounded-chip border-[1.5px] transition-colors duration-150",
                    already ? "cursor-not-allowed border-line bg-bg text-ink-muted" : on ? "border-primary bg-primary text-surface" : "border-line bg-surface text-ink hover:border-line-strong",
                  )}
                >
                  <span className="text-[11px] opacity-85">{already ? "มีแล้ว" : d.sub}</span>
                  <span className="text-[13px] font-semibold">วัน {d.day}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button size="lg" block disabled={!ok} onClick={save} aria-busy={pending || undefined}>
          {pending ? "กำลังเพิ่ม…" : ok ? `เพิ่มลงแผน ${dayList.length} วัน` : "เลือกสถานที่และวัน"}
        </Button>
      </footer>
    </>
  );
}
