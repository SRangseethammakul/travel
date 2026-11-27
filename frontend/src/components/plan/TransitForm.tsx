"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, transitModeIcon } from "@/components/ui/Icon";
import { fieldClass, fieldLabelClass, pillClass } from "@/components/ui/field";
import { saveTransit, updateTransitAction, uploadTripDocument } from "@/lib/api/plan-actions";
import type { ID, TransitMode } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBahtInput, parseBahtInput } from "@/lib/money/input";
import { TRANSIT_MODES, type TransitDraft } from "@/lib/plan-form";

const MODE_LABEL: Record<TransitMode, string> = {
  plane: "เครื่องบิน",
  train: "รถไฟ/ชินคันเซ็น",
  bus: "รถทัวร์",
  car: "รถเช่า",
  boat: "เรือ",
  walk: "เดิน",
  other: "อื่นๆ",
};

interface TransitFormProps {
  tripId: ID;
  trip: { startDate: string; endDate: string };
  defaultDate: string;
  documents: { id: ID; name: string; mime: string }[];
  /** Airport / station / hotel Places to fill ต้นทาง or ปลายทาง. */
  placeOptions: { id: ID; name: string }[];
  canAddExpense: boolean;
  /** Edit mode: the saved Transit, prefilled. Its linked expense is shown as a link instead of offering a second one. */
  edit?: { itemId: ID; draft: TransitDraft; expenseHref?: string };
}

const smallField = "h-10 min-w-0 rounded-[10px] border border-line bg-surface px-2 text-base text-ink";

/** AddTransit (18): a booked journey shown as a purple card in the Planner. */
export function TransitForm({ tripId, trip, defaultDate, documents, placeOptions, canAddExpense, edit }: TransitFormProps) {
  const ids = useId();
  const init = edit?.draft;
  const [mode, setMode] = useState<TransitMode>(init?.mode ?? "plane");
  const [fromText, setFromText] = useState(init?.fromText ?? "");
  const [toText, setToText] = useState(init?.toText ?? "");
  const [fromPlaceId, setFromPlaceId] = useState<ID | undefined>(init?.fromPlaceId);
  const [toPlaceId, setToPlaceId] = useState<ID | undefined>(init?.toPlaceId);
  const [departDate, setDepartDate] = useState(init?.departDate ?? defaultDate);
  const [departTime, setDepartTime] = useState(init?.departTime ?? "");
  const [arriveDate, setArriveDate] = useState(init?.arriveDate ?? defaultDate);
  const [arriveTime, setArriveTime] = useState(init?.arriveTime ?? "");
  const [bookingRef, setBookingRef] = useState(init?.bookingRef ?? "");
  const [seatInfo, setSeatInfo] = useState(init?.seatInfo ?? "");
  const [docs, setDocs] = useState(documents);
  const [docIds, setDocIds] = useState<ID[]>(init?.docIds ?? []);
  const [withCost, setWithCost] = useState(false);
  const [costText, setCostText] = useState("");
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const cost = parseBahtInput(costText) ?? 0;
  const ready = !!fromText.trim() && !!toText.trim() && !!departDate && !!departTime && !!arriveDate && !!arriveTime;
  const canSave = ready && (!withCost || cost > 0) && !pending;

  const fillFromList = (p: { id: ID; name: string }) => {
    if (!fromText.trim() || (fromText.trim() && toText.trim())) {
      setFromText(p.name);
      setFromPlaceId(p.id);
    } else {
      setToText(p.name);
      setToPlaceId(p.id);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    startUpload(async () => {
      const form = new FormData();
      form.append("file", file);
      const r = await uploadTripDocument(tripId, form);
      if ("error" in r) setUploadError(r.error);
      else {
        setDocs((d) => [...d, { id: r.id, name: file.name, mime: file.type }]);
        setDocIds((d) => [...d, r.id]);
      }
    });
  };

  const save = () => {
    if (!canSave) return;
    setError("");
    startTransition(async () => {
      const draft = { mode, fromText, toText, departDate, departTime, arriveDate, arriveTime, bookingRef, seatInfo, docIds, fromPlaceId, toPlaceId };
      const r = edit ? await updateTransitAction(tripId, edit.itemId, draft) : await saveTransit(tripId, draft, withCost ? cost : null);
      if (r?.error) setError(r.error);
    });
  };

  const end = (which: "from" | "to") => {
    const isFrom = which === "from";
    return (
      <div className={cn("flex flex-col gap-1 px-3.5 py-3", isFrom && "border-b border-line")}>
        <label htmlFor={`${ids}-${which}`} className="text-xs font-semibold text-ink-muted">
          {isFrom ? "ต้นทาง" : "ปลายทาง"}
        </label>
        <input
          id={`${ids}-${which}`}
          type="text"
          maxLength={80}
          value={isFrom ? fromText : toText}
          placeholder={isFrom ? "เช่น สนามบินฮาเนดะ (HND)" : "เช่น สุวรรณภูมิ (BKK)"}
          onChange={(e) => {
            if (isFrom) {
              setFromText(e.target.value);
              setFromPlaceId(undefined);
            } else {
              setToText(e.target.value);
              setToPlaceId(undefined);
            }
          }}
          className="h-8 border-0 bg-transparent p-0 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted/70 focus-visible:outline-none"
        />
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`${ids}-${which}-d`} className="text-xs text-ink-muted">
              {isFrom ? "วันที่ออก" : "วันที่ถึง"}
            </label>
            <input
              id={`${ids}-${which}-d`}
              type="date"
              min={isFrom ? trip.startDate : undefined}
              max={isFrom ? trip.endDate : undefined}
              value={isFrom ? departDate : arriveDate}
              onChange={(e) => (isFrom ? setDepartDate(e.target.value) : setArriveDate(e.target.value))}
              className={smallField}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`${ids}-${which}-t`} className="text-xs text-ink-muted">
              {isFrom ? "เวลาออก" : "เวลาถึง"}
            </label>
            <input
              id={`${ids}-${which}-t`}
              type="time"
              value={isFrom ? departTime : arriveTime}
              onChange={(e) => (isFrom ? setDepartTime(e.target.value) : setArriveTime(e.target.value))}
              className={smallField}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <main className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-5">
        {edit ? null : (
          <p className="m-0 text-[13px] leading-normal text-ink-muted">
            สำหรับการเดินทางที่จองไว้ เช่น เที่ยวบิน ชินคันเซ็น รถทัวร์ รับรถเช่า ส่วนการเดินทางสั้นๆ ระหว่างสถานที่ ให้กดช่องระหว่างรายการในหน้าแผน
          </p>
        )}

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className={cn(fieldLabelClass, "mb-2 p-0")}>ประเภท</legend>
          <div role="radiogroup" aria-label="ประเภท" className="flex flex-wrap gap-2">
            {TRANSIT_MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={pillClass(mode === m)}>
                <Icon name={transitModeIcon[m]} size={16} />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <section aria-label="ต้นทางและปลายทาง" className="flex flex-col overflow-hidden rounded-2xl border border-line-strong">
            {end("from")}
            {end("to")}
          </section>
          {placeOptions.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-muted">เลือกจากลิสต์:</span>
              {placeOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => fillFromList(p)}
                  className="relative min-h-8 cursor-pointer rounded-full border border-line-strong bg-surface px-2.5 text-xs text-ink before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:border-ink-muted"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-ref`} className={fieldLabelClass}>
            เลขที่จอง / เที่ยวบิน (ไม่บังคับ)
          </label>
          <input id={`${ids}-ref`} type="text" maxLength={40} value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="เช่น เลขเที่ยวบิน หรือรหัสการจอง" className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-seat`} className={fieldLabelClass}>
            ที่นั่ง (ไม่บังคับ)
          </label>
          <input id={`${ids}-seat`} type="text" maxLength={200} value={seatInfo} onChange={(e) => setSeatInfo(e.target.value)} placeholder="เช่น 12A หรือ ตู้ 5 ที่นั่ง 3" className={fieldClass} />
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className={cn(fieldLabelClass, "mb-2 p-0")}>แนบเอกสารจากทริป</legend>
          {docs.map((d) => {
            const on = docIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setDocIds(on ? docIds.filter((x) => x !== d.id) : [...docIds, d.id])}
                className={cn(
                  "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-icon border-[1.5px] px-3 text-left text-ink transition-colors",
                  on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span aria-hidden="true" className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 text-surface", on ? "border-primary bg-primary" : "border-disabled bg-surface")}>
                  {on ? <Icon name="check" size={14} /> : null}
                </span>
                <span aria-hidden="true" className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft font-display text-[10px] font-bold text-danger">
                  {d.mime === "application/pdf" ? "PDF" : "รูป"}
                </span>
                <span className="flex-1 text-sm font-semibold">{d.name}</span>
              </button>
            );
          })}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="dashed" block size="sm" icon={<Icon name="plus" size={14} />} disabled={uploading} onClick={() => fileRef.current?.click()} className="rounded-icon text-sm">
            {uploading ? "กำลังอัปโหลด…" : "อัปโหลดเอกสารใหม่"}
          </Button>
          {uploadError ? (
            <p role="alert" className="m-0 text-[13px] text-danger">
              {uploadError}
            </p>
          ) : null}
        </fieldset>

        {edit?.expenseHref ? (
          <Link href={edit.expenseHref} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-bg px-3.5 text-sm font-semibold text-ink no-underline hover:bg-line-soft hover:text-ink">
            ดูค่าใช้จ่ายที่บันทึกไว้
            <Icon name="chevronRight" size={16} className="text-ink-subtle" />
          </Link>
        ) : null}

        {canAddExpense && !edit ? (
          <section className="flex flex-col gap-2.5 rounded-2xl bg-bg p-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={withCost}
              onClick={() => setWithCost(!withCost)}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-ink"
            >
              <span className="flex flex-col">
                <span className="text-sm font-semibold">บันทึกเป็นค่าใช้จ่ายด้วย</span>
                <span className="text-xs text-ink-muted">หมวด &quot;เดินทาง&quot; · ไปหน้าหารเงินต่อหลังบันทึก</span>
              </span>
              <span aria-hidden="true" className={cn("flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors duration-200", withCost ? "justify-end bg-primary" : "justify-start bg-control")}>
                <span className="size-5 rounded-full bg-surface shadow-seg" />
              </span>
            </button>
            {withCost ? (
              <div className="flex h-12 items-center gap-2 rounded-icon border border-line-strong bg-surface px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                <span aria-hidden="true" className="font-display font-semibold text-ink-muted">
                  ฿
                </span>
                <label htmlFor={`${ids}-cost`} className="sr-only">
                  ค่าโดยสารรวม (บาท)
                </label>
                <input
                  id={`${ids}-cost`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="ค่าโดยสารรวม"
                  value={costText}
                  onChange={(e) => setCostText(formatBahtInput(e.target.value))}
                  className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none focus-visible:outline-none"
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button size="lg" block disabled={!canSave} onClick={save} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? "กำลังบันทึก…" : !ready ? "ใส่ต้นทาง ปลายทาง และเวลา" : edit ? "บันทึกการแก้ไข" : withCost ? "บันทึก แล้วไปหารค่าเดินทาง" : "บันทึกลงแผน"}
        </Button>
      </footer>
    </>
  );
}
