"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { formatFileSize } from "@/components/expenses/SlipPicker";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { solidBg } from "@/components/ui/colors";
import { Icon } from "@/components/ui/Icon";
import { uploadTripDocument } from "@/lib/api/plan-actions";
import { createTripAction } from "@/lib/api/trip-actions";
import type { ColorKey } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateRange, parseISODate } from "@/lib/date";
import { formatBahtInput, parseBahtInput } from "@/lib/money/input";
import {
  DOCUMENT_QUICK_NAMES,
  fileBaseName,
  isAllowedDocument,
  memberColor,
  TRIP_COVERS,
  type TripDocDraft,
} from "@/lib/trip-form";

interface CreateTripFormProps {
  me: { name: string; color: ColorKey };
  defaultStart: string;
  defaultEnd: string;
}

const inputClass =
  "h-12 w-full min-w-0 rounded-icon border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted";

/** A picked document: what the form shows, plus the file to upload after the trip exists. */
type DocItem = TripDocDraft & { file: File };

function validDate(value: string) {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

/** CreateTrip (page 6): cover, name, destination, dates, budget, Members, documents. */
export function CreateTripForm({ me, defaultStart, defaultEnd }: CreateTripFormProps) {
  const router = useRouter();
  const ids = { name: useId(), dest: useId(), start: useId(), end: useId(), budget: useId(), member: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<ColorKey>("ink");
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [budget, setBudget] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);
  /** Set when the trip was created but some documents failed: the form must not create it again. */
  const [created, setCreated] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const datesOk = validDate(startDate) && validDate(endDate) && startDate <= endDate;
  const count = memberNames.length + 1;

  const addMember = () => {
    const n = draft.trim().replace(/\s+/g, " ");
    if (!n) return;
    const taken = [me.name, ...memberNames].some((x) => x.toLowerCase() === n.toLowerCase());
    if (taken) {
      setError(`มีชื่อ "${n}" อยู่แล้ว`);
      return;
    }
    setError("");
    setMemberNames([...memberNames, n]);
    setDraft("");
  };

  const pickFiles = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    const ok = list.filter((f) => isAllowedDocument(f.type, f.size));
    setFileError(ok.length < list.length ? "แนบได้เฉพาะ PDF หรือรูป ขนาดไม่เกิน 10 MB" : "");
    setDocs((d) => [...d, ...ok.map((f) => ({ name: "", fileName: f.name, mime: f.type, size: f.size, file: f }))]);
  };

  const setDocName = (i: number, value: string) => setDocs((d) => d.map((x, j) => (j === i ? { ...x, name: value } : x)));

  const submit = (then: "trip" | "members") => {
    const parsedBudget = parseBahtInput(budget);
    if (parsedBudget === null) {
      setError("งบประมาณไม่ถูกต้อง");
      return;
    }
    startTransition(async () => {
      setError("");
      const result = await createTripAction(
        {
          name,
          destination,
          startDate,
          endDate,
          budget: parsedBudget || null,
          cover,
          memberNames,
          documents: docs.map(({ name, fileName, mime, size }) => ({ name, fileName, mime, size })),
        },
        then,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // One upload per file (B12); a failure keeps the trip and says which file to add again later.
      const failed: string[] = [];
      for (const d of docs) {
        const form = new FormData();
        form.append("file", d.file, d.file.name);
        form.append("name", (d.name.trim() || fileBaseName(d.fileName)).slice(0, 120));
        const r = await uploadTripDocument(result.tripId, form);
        if ("error" in r) failed.push(`${d.name.trim() || d.fileName} (${r.error})`);
      }
      if (failed.length) {
        setCreated(result.href);
        setError(`สร้างทริปแล้ว แต่อัปโหลดเอกสารไม่สำเร็จ: ${failed.join(", ")} · เพิ่มใหม่ได้ที่หน้าเอกสารของทริป`);
        return;
      }
      router.push(result.href);
    });
  };

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!created) submit("trip");
      }}
    >
      <main className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-5">
        <div aria-hidden="true" className={cn("flex flex-col gap-1.5 rounded-[22px] p-[18px] text-surface", solidBg[cover])}>
          <span className="text-[13px] opacity-90">{destination.trim() || "ปลายทาง"}</span>
          <span className="font-display text-[22px] leading-[1.3] font-semibold">{name.trim() || "ชื่อทริป"}</span>
          <span className="text-[13px] opacity-90">
            {count} คน{datesOk ? ` · ${formatDateRange(startDate, endDate)}` : ""}
          </span>
        </div>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold">สีหน้าปกทริป</legend>
          <div role="radiogroup" aria-label="สีหน้าปกทริป" className="flex gap-2.5">
            {TRIP_COVERS.map((c) => {
              const on = c.key === cover;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.label}
                  onClick={() => setCover(c.key)}
                  className={cn(
                    "size-11 cursor-pointer rounded-full border-[3px] border-surface transition-shadow duration-150",
                    solidBg[c.key],
                    on ? "ring-2 ring-ink" : "ring-2 ring-line",
                  )}
                />
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className="text-sm font-semibold">
            ชื่อทริป
          </label>
          <input id={ids.name} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น โตเกียวหน้าหนาว" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.dest} className="text-sm font-semibold">
            ปลายทาง
          </label>
          <div className="flex h-12 items-center gap-2 rounded-icon border border-line-strong px-3.5 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <Icon name="place" size={18} />
            <input
              id={ids.dest}
              required
              maxLength={80}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="เมือง หรือ ประเทศ"
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.start} className="text-sm font-semibold">
              วันไป
            </label>
            <input
              id={ids.start}
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              className={cn(inputClass, "px-3")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.end} className="text-sm font-semibold">
              วันกลับ
            </label>
            <input id={ids.end} type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={cn(inputClass, "px-3")} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.budget} className="text-sm font-semibold">
            งบประมาณรวม (ไม่บังคับ)
          </label>
          <div className="flex h-12 items-center gap-2 rounded-icon border border-line-strong px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <span aria-hidden="true" className="font-display font-semibold text-ink-muted">
              ฿
            </span>
            <input
              id={ids.budget}
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(formatBahtInput(e.target.value))}
              placeholder="0"
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        </div>

        <section aria-labelledby={`${ids.member}-h`} className="flex flex-col gap-2.5">
          <h2 id={`${ids.member}-h`} className="m-0 text-sm font-semibold">
            สมาชิก ({count})
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <li className="flex min-h-10 items-center gap-2 rounded-full bg-bg py-1 pr-3 pl-1">
              <Avatar name={me.name} color={me.color} size="sm" />
              <span className="text-sm font-medium">{me.name} (คุณ)</span>
            </li>
            {memberNames.map((n, i) => (
              <li key={n} className="flex min-h-10 items-center gap-2 rounded-full bg-bg py-1 pr-0.5 pl-1">
                <Avatar name={n} color={memberColor(i, me.color)} size="sm" />
                <span className="text-sm font-medium">{n}</span>
                <button
                  type="button"
                  aria-label={`ลบ ${n}`}
                  onClick={() => setMemberNames(memberNames.filter((_, j) => j !== i))}
                  className="relative flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-muted before:absolute before:-inset-1.5 before:content-[''] hover:bg-line hover:text-ink"
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <label htmlFor={ids.member} className="sr-only">
              ชื่อสมาชิกใหม่
            </label>
            <input
              id={ids.member}
              maxLength={40}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMember();
                }
              }}
              placeholder="พิมพ์ชื่อสมาชิก"
              className={cn(inputClass, "flex-1")}
            />
            <button
              type="button"
              onClick={addMember}
              className="h-12 shrink-0 cursor-pointer rounded-icon border-0 bg-primary-soft px-4 text-sm font-semibold text-primary-ink hover:bg-primary-highlight"
            >
              เพิ่ม
            </button>
          </div>
          <p className="m-0 text-xs leading-normal text-ink-muted">เพื่อนที่เพิ่มชื่อไว้ เลือกชื่อตัวเองได้ตอนเปิดลิงก์เชิญ ค่าใช้จ่ายที่บันทึกในชื่อนั้นจะย้ายไปอยู่ในบัญชีเขา</p>
          <button type="button" onClick={() => submit("members")} disabled={pending || created !== null} className={buttonClasses({ variant: "dashed", size: "sm", block: true, className: "text-sm" })}>
            <Icon name="link" size={18} />
            หรือส่งลิงก์เชิญให้เพื่อนเข้าร่วมเอง
          </button>
        </section>

        <section aria-labelledby="docs-h" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 id="docs-h" className="m-0 text-sm font-semibold">
              เอกสารการเดินทาง ({docs.length})
            </h2>
            <span className="text-xs text-ink-muted">ไม่บังคับ</span>
          </div>
          <p className="m-0 text-xs leading-normal text-ink-muted">เช่น ใบจองโรงแรม ใบจองรถ ตั๋วเครื่องบิน · สมาชิกทุกคนในทริปเปิดดูได้</p>
          {docs.map((d, i) => {
            const pdf = d.mime === "application/pdf";
            const needName = !d.name.trim();
            return (
              <div key={`${d.fileName}-${i}`} className={cn("flex flex-col gap-2.5 rounded-2xl border bg-surface p-3", needName ? "border-todo-line" : "border-line")}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-12 w-[42px] shrink-0 items-center justify-center rounded-[10px] font-display text-[11px] font-bold tracking-wide",
                      pdf ? "bg-danger-soft text-danger" : "bg-interest-soft text-type-interest",
                    )}
                  >
                    {pdf ? "PDF" : "IMG"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <input
                      aria-label={`ชื่อเอกสาร ${d.fileName}`}
                      value={d.name}
                      maxLength={120}
                      onChange={(e) => setDocName(i, e.target.value)}
                      placeholder="ตั้งชื่อเอกสาร"
                      className={cn(
                        "h-8 min-w-0 border-0 border-b-[1.5px] bg-transparent p-0 text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-muted",
                        needName ? "border-todo-line" : "border-line",
                      )}
                    />
                    <span className="truncate text-xs text-ink-muted">
                      {d.fileName} · {pdf ? "PDF" : "รูปภาพ"} · {formatFileSize(d.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`ลบ ${d.fileName}`}
                    onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                    className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-chip border-0 bg-bg text-ink-muted before:absolute before:-inset-0.5 before:content-[''] hover:bg-line hover:text-ink"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                {needName ? (
                  <div role="group" aria-label={`ชื่อสำเร็จรูปสำหรับ ${d.fileName}`} className="flex flex-wrap gap-1.5">
                    {DOCUMENT_QUICK_NAMES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setDocName(i, q)}
                        className="relative min-h-[34px] cursor-pointer rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:border-ink-muted"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary-wash text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            อัปโหลดไฟล์ (PDF หรือรูปภาพ)
          </button>
          {fileError ? (
            <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
              {fileError}
            </p>
          ) : null}
        </section>
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        {created ? (
          <Button size="lg" block onClick={() => router.push(created)} className="h-[54px] rounded-2xl">
            ไปที่ทริป
          </Button>
        ) : (
          <Button type="submit" size="lg" block disabled={pending} aria-busy={pending || undefined} className="h-[54px] rounded-2xl">
            {pending ? "กำลังสร้างทริป…" : "สร้างทริป"}
          </Button>
        )}
      </footer>
    </form>
  );
}
