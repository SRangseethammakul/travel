"use client";

import { useId, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { placeTypeStyle } from "@/components/ui/colors";
import { addPillClass, fieldClass, fieldLabelClass, pillClass, textareaClass } from "@/components/ui/field";
import { savePlace } from "@/lib/api/plan-actions";
import type { ID, PlaceType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { cleanLabel, cleanTagName, isMapUrl, isNewTagName, MAX_PLACE_NAME, MAX_TAGS, PLACE_TYPES, tagSuggestions, type PlaceDraft } from "@/lib/place-form";

export interface FormTag {
  id: ID;
  name: string;
  ownerId: ID;
}

interface PlaceFormProps {
  tripId: ID;
  userId: ID;
  /** Trip cities, City Leg order first. */
  cities: string[];
  /** Areas already used per city, most relevant first. */
  areasByCity: Record<string, string[]>;
  /** "Tokyo วันที่ 1–4" per city (multi-city trips). */
  legHints: Record<string, string>;
  defaultCity: string;
  myTags: FormTag[];
  /** Tags of other members already used in this trip. */
  tripTags: FormTag[];
}

/** Pick one of the existing values or type a new one (city / area). */
function ChoiceRow({
  label,
  values,
  value,
  onChange,
  addLabel,
  allowNone,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  addLabel: string;
  allowNone?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const inputId = useId();
  const add = () => {
    const v = cleanLabel(text);
    if (v) onChange(v);
    setAdding(false);
    setText("");
  };
  const all = value && !values.includes(value) ? [...values, value] : values;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {all.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={pillClass(value === v)}>
          {v}
        </button>
      ))}
      {allowNone ? (
        <button type="button" role="radio" aria-checked={value === ""} onClick={() => onChange("")} className={pillClass(value === "")}>
          ไม่ระบุ
        </button>
      ) : null}
      {adding ? (
        <span className="flex w-full items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            {addLabel}
          </label>
          <input
            id={inputId}
            autoFocus
            maxLength={40}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={addLabel}
            className={cn(fieldClass, "h-11 flex-1")}
          />
          <Button size="sm" onClick={add} disabled={!cleanLabel(text)}>
            เพิ่ม
          </Button>
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={addPillClass}>
          <Icon name="plus" size={12} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

/** AddPlace (8) / AddPlaceJP (15): saves straight to the trip's list, no day needed. */
export function PlaceForm({ tripId, userId, cities, areasByCity, legHints, defaultCity, myTags, tripTags }: PlaceFormProps) {
  const ids = useId();
  const multiCity = cities.length > 1;
  const [name, setName] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [type, setType] = useState<PlaceType>("food");
  const [city, setCity] = useState(defaultCity);
  const [area, setArea] = useState("");
  const [tagIds, setTagIds] = useState<ID[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pasteHint, setPasteHint] = useState("");
  const [pending, startTransition] = useTransition();

  const allTags = [...myTags, ...tripTags];
  const tagName = (id: ID) => allTags.find((t) => t.id === id)?.name ?? "";
  const suggestions = tagSuggestions(userId, myTags, tripTags, tagIds, draftTag);
  const draftClean = cleanTagName(draftTag);
  const canCreate = isNewTagName(draftTag, allTags, [...newTags, ...tagIds.map(tagName)]);
  const full = tagIds.length + newTags.length >= MAX_TAGS;
  const mapInvalid = mapUrl.trim() !== "" && !isMapUrl(mapUrl.trim());
  const canSave = cleanLabel(name).length > 0 && !!cleanLabel(city) && !mapInvalid && !pending;

  const addDraft = () => {
    if (!draftClean || full) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === draftClean.toLowerCase());
    if (existing) {
      if (!tagIds.includes(existing.id)) setTagIds([...tagIds, existing.id]);
    } else if (canCreate) setNewTags([...newTags, draftClean]);
    setDraftTag("");
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDraft();
    }
    if (e.key === "Backspace" && !draftTag) {
      if (newTags.length) setNewTags(newTags.slice(0, -1));
      else if (tagIds.length) setTagIds(tagIds.slice(0, -1));
    }
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (isMapUrl(text)) {
        setMapUrl(text);
        setPasteHint("");
      } else setPasteHint("สิ่งที่คัดลอกไว้ไม่ใช่ลิงก์");
    } catch {
      setPasteHint("วางไม่ได้ ลองกดค้างที่ช่องแล้วเลือกวาง");
    }
  };

  const submit = (then: "list" | "plan") => (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    setError("");
    const draft: PlaceDraft = { name, mapUrl, type, city, area, tagIds, newTagNames: newTags, note };
    startTransition(async () => {
      const result = await savePlace(tripId, draft, then);
      if (result?.error) setError(result.error);
    });
  };

  const sections: Record<"type" | "city" | "area", ReactNode> = {
    type: (
      <fieldset key="type" className="m-0 flex flex-col border-0 p-0">
        <legend className={cn(fieldLabelClass, "mb-2 p-0")}>ประเภท</legend>
        <div role="radiogroup" aria-label="ประเภท" className="flex flex-wrap gap-2">
          {PLACE_TYPES.map((t) => {
            const on = type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t)}
                className={cn(
                  "relative inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-semibold text-ink transition-colors",
                  "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
                  on ? "border-ink bg-bg" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full", placeTypeStyle[t].bar)} />
                {placeTypeStyle[t].label}
              </button>
            );
          })}
        </div>
      </fieldset>
    ),
    city: (
      <fieldset key="city" className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className={cn(fieldLabelClass, "mb-2 p-0")}>เมือง</legend>
        <ChoiceRow
          label="เมือง"
          values={cities}
          value={city}
          onChange={(v) => {
            setCity(v);
            setArea("");
          }}
          addLabel="เมืองใหม่"
        />
        {multiCity && legHints[city] ? <span className="text-xs text-ink-muted">ตามเส้นทางทริป: {legHints[city]}</span> : null}
      </fieldset>
    ),
    area: (
      <fieldset key="area" className="m-0 flex flex-col border-0 p-0">
        <legend className={cn(fieldLabelClass, "mb-2 p-0")}>{multiCity ? `ย่านใน ${city}` : "ย่าน"}</legend>
        <ChoiceRow key={city} label="ย่าน" values={areasByCity[city] ?? []} value={area} onChange={setArea} addLabel="ย่านใหม่" allowNone />
      </fieldset>
    ),
  };
  const order: ("type" | "city" | "area")[] = multiCity ? ["city", "area", "type"] : ["type", "city", "area"];

  const tagButton = (t: FormTag) => (
    <button
      key={t.id}
      type="button"
      disabled={full}
      onClick={() => setTagIds([...tagIds, t.id])}
      className="relative min-h-9 cursor-pointer rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      #{t.name}
    </button>
  );

  return (
    <form onSubmit={submit("list")} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-name`} className={fieldLabelClass}>
            ชื่อสถานที่
          </label>
          <input
            id={`${ids}-name`}
            type="text"
            maxLength={MAX_PLACE_NAME}
            placeholder="ชื่อร้านหรือสถานที่"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-map`} className={fieldLabelClass}>
            ลิงก์ Google Maps (ไม่บังคับ)
          </label>
          <div
            className={cn(
              "flex h-12 items-center gap-2 rounded-icon border bg-surface pr-1.5 pl-3.5 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
              mapInvalid ? "border-danger" : "border-line-strong",
            )}
          >
            <Icon name="link" size={18} />
            <input
              id={`${ids}-map`}
              type="url"
              inputMode="url"
              placeholder="วางลิงก์ที่แชร์จาก Google Maps"
              value={mapUrl}
              aria-invalid={mapInvalid || undefined}
              aria-describedby={`${ids}-map-hint`}
              onChange={(e) => setMapUrl(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink outline-none focus-visible:outline-none"
            />
            <button type="button" onClick={paste} className="min-h-11 shrink-0 cursor-pointer rounded-[10px] border-0 bg-bg px-3 text-[13px] font-semibold text-ink hover:bg-line">
              วาง
            </button>
          </div>
          <span id={`${ids}-map-hint`} className={cn("text-xs", mapInvalid ? "text-danger" : "text-ink-muted")}>
            {mapInvalid ? "ลิงก์ต้องขึ้นต้นด้วย https://" : pasteHint || "เก็บไว้ให้กดเปิดใน Google Maps เท่านั้น"}
          </span>
        </div>

        {order.map((k) => sections[k])}

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${ids}-tag`} className={fieldLabelClass}>
              Tag
            </label>
            <span className="text-xs text-ink-muted">ใส่ได้หลายอัน</span>
          </div>
          <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-icon border-[1.5px] border-line-strong px-2 py-1.5 focus-within:border-primary">
            {[...tagIds.map((id) => ({ key: id, name: tagName(id), remove: () => setTagIds(tagIds.filter((x) => x !== id)) })),
              ...newTags.map((n) => ({ key: `new:${n}`, name: n, remove: () => setNewTags(newTags.filter((x) => x !== n)) }))].map((t) => (
              <span key={t.key} className="flex min-h-8 items-center gap-0.5 rounded-full bg-primary-soft pl-2.5 text-sm font-semibold text-primary-ink">
                #{t.name}
                <button
                  type="button"
                  aria-label={`ลบ tag ${t.name}`}
                  onClick={t.remove}
                  className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-primary-ink before:absolute before:-inset-2 before:content-[''] hover:bg-primary-highlight/60"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
            <input
              id={`${ids}-tag`}
              type="text"
              maxLength={30}
              value={draftTag}
              disabled={full}
              onChange={(e) => setDraftTag(e.target.value)}
              onKeyDown={onTagKey}
              placeholder={full ? `ครบ ${MAX_TAGS} อันแล้ว` : "พิมพ์ tag ใหม่"}
              className="h-8 min-w-[100px] flex-1 border-0 bg-transparent px-1 text-base text-ink outline-none focus-visible:outline-none"
            />
          </div>
          {canCreate && !full ? (
            <button
              type="button"
              onClick={addDraft}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 self-start rounded-full border border-dashed border-primary bg-surface px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              <Icon name="plus" size={14} />
              สร้าง tag &quot;{draftClean}&quot;
            </button>
          ) : null}
          {suggestions.mine.length ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">tag ที่คุณเคยใช้</span>
              <div className="flex flex-wrap gap-1.5">{suggestions.mine.map(tagButton)}</div>
            </div>
          ) : null}
          {suggestions.others.length ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-muted">tag อื่นในทริปนี้</span>
              <div className="flex flex-wrap gap-1.5">{suggestions.others.map(tagButton)}</div>
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-note`} className={fieldLabelClass}>
            โน้ต
          </label>
          <textarea id={`${ids}-note`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={textareaClass} />
        </div>

        <button
          type="button"
          onClick={() => submit("plan")()}
          disabled={!canSave}
          className="flex min-h-[52px] cursor-pointer items-center justify-between rounded-icon border border-line bg-surface px-3.5 text-left text-ink hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">ลงแผน</span>
            <span className="text-xs text-ink-muted">ยังไม่จัดวัน · บันทึกแล้วเลือกวันต่อ</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" block disabled={!canSave} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? "กำลังบันทึก…" : "บันทึกลงลิสต์"}
        </Button>
      </footer>
    </form>
  );
}
