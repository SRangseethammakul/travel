"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { placeTypeStyle } from "@/components/ui/colors";
import { addPillClass, fieldClass, fieldLabelClass, pillClass, textareaClass } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { uploadPlacePhotoAction } from "@/lib/api/place-photo-actions";
import { createPlace, deletePlaceAction, savePlace, updatePlaceAction } from "@/lib/api/plan-actions";
import type { ID, Place, PlaceType } from "@/lib/api/types";
import { formatMoney } from "@/lib/money/format";
import { formatBahtInput, satangToInput } from "@/lib/money/input";
import { cn } from "@/lib/cn";
import { prepareImage } from "@/lib/image-resize";
import { MAX_PHOTO_BYTES } from "@/lib/place-photos";
import { stayExpenseSplitText } from "@/lib/stay-expense";
import { NewPlacePhotos } from "./NewPlacePhotos";
import { checkPlaceDraft, cleanLabel, cleanTagName, defaultStayDates, isMapUrl, isNewTagName, MAX_PLACE_NAME, MAX_TAGS, PLACE_TYPES, stayExpenseSync, stayNights, tagSuggestions, type LinkedStayExpense, type PlaceDraft } from "@/lib/place-form";

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
  /** Edit mode: the Place being changed (the form starts from it and saves with PATCH). */
  initial?: Place;
  /** Trip dates, bounds of the check-in / check-out fields. */
  tripDates: { start: string; end: string };
  /** Day the user came from (`/plan/add?day=`), kept when continuing to pick days. */
  fromDay?: number;
  /** New place: type chosen from where the user came from (e.g. "stay" from "ที่พักแต่ละคืน"). Otherwise none is pre-selected. */
  defaultType?: PlaceType;
  /** Show "บันทึกเป็นค่าใช้จ่ายด้วย" for a hotel with a price. */
  canAddExpense?: boolean;
  /** Members of the trip: a shared cost only makes sense with 2+, so the switch starts on only then. */
  memberCount?: number;
  /** Edit mode: the Expense this hotel's price is recorded in (see PlaceStay.expenseId). */
  linkedExpense?: (LinkedStayExpense & { title: string }) | null;
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
export function PlaceForm({ tripId, userId, cities, areasByCity, legHints, defaultCity, myTags, tripTags, initial, tripDates, fromDay, defaultType, canAddExpense = false, memberCount = 1, linkedExpense = null }: PlaceFormProps) {
  const ids = useId();
  const multiCity = cities.length > 1;
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [mapUrl, setMapUrl] = useState(initial?.mapUrl ?? "");
  const [type, setType] = useState<PlaceType | "">(initial?.type ?? defaultType ?? "");
  const [city, setCity] = useState(initial?.city ?? defaultCity);
  const [area, setArea] = useState(initial?.area ?? "");
  const [tagIds, setTagIds] = useState<ID[]>(initial?.tagIds ?? []);
  // A new hotel starts on the day the user came from (?day=), checking out the next day.
  const seed = defaultStayDates({ startDate: tripDates.start, endDate: tripDates.end }, initial ? undefined : fromDay);
  const [checkIn, setCheckIn] = useState(initial?.stay?.checkIn ?? seed.checkIn);
  const [checkOut, setCheckOut] = useState(initial?.stay?.checkOut ?? seed.checkOut);
  const [price, setPrice] = useState(initial?.stay?.price ? satangToInput(initial.stay.price) : "");
  const [bookingRef, setBookingRef] = useState(initial?.stay?.bookingRef ?? "");
  const [address, setAddress] = useState(initial?.stay?.address ?? "");
  // null = the user has not touched the switch: on for a new hotel shared by 2+ members, off when editing.
  const [asExpenseChoice, setAsExpenseChoice] = useState<boolean | null>(null);
  const asExpense = asExpenseChoice ?? (!editing && memberCount >= 2);
  const [syncAsk, setSyncAsk] = useState<"update" | "manual" | "locked" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [draftTag, setDraftTag] = useState("");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [pasteHint, setPasteHint] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // AddPlace only: photos picked before the Place exists, uploaded after it is saved.
  const [photos, setPhotos] = useState<File[]>([]);
  /** "2/5" while the picked photos upload after the save. */
  const [photoProgress, setPhotoProgress] = useState("");

  const allTags = [...myTags, ...tripTags];
  const tagName = (id: ID) => allTags.find((t) => t.id === id)?.name ?? "";
  const suggestions = tagSuggestions(userId, myTags, tripTags, tagIds, draftTag);
  const draftClean = cleanTagName(draftTag);
  const canCreate = isNewTagName(draftTag, allTags, [...newTags, ...tagIds.map(tagName)]);
  const full = tagIds.length + newTags.length >= MAX_TAGS;
  const mapInvalid = mapUrl.trim() !== "" && !isMapUrl(mapUrl.trim());
  const draftNow: PlaceDraft = { name, mapUrl, type, city, area, tagIds, newTagNames: newTags, note, checkIn, checkOut, price, bookingRef, address };
  const check = checkPlaceDraft(draftNow);
  const canSave = check.ok && !pending;
  const stayPrice = check.ok ? (check.stay?.price ?? 0) : 0;
  // A hotel already linked to an expense never offers a second one.
  const offerExpense = canAddExpense && type === "stay" && stayPrice > 0 && !initial?.stay?.expenseId;
  const savedStay = initial?.stay;
  const linked = savedStay?.expenseId ? linkedExpense : null;
  const newStay = check.ok ? check.stay : undefined;
  const syncKind = stayExpenseSync(savedStay, newStay, linked);
  // Nights changed but the price was left alone: the price (and linked cost) may now be wrong.
  const nightsNow = checkIn && checkOut && checkOut > checkIn ? stayNights({ checkIn, checkOut }) : null;
  const nightsChanged = !!savedStay?.price && nightsNow !== null && nightsNow !== stayNights(savedStay) && stayPrice === savedStay.price;
  // Tell the user what is missing instead of leaving the button grey.
  const missing = check.ok ? "" : check.error;

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
    // Price changed on a hotel whose cost is recorded: ask before touching the cost.
    if (initial && syncKind) {
      setSyncAsk(syncKind);
      return;
    }
    save(then, null);
  };

  const save = (then: "list" | "plan", expenseSync: "update" | "manual" | null) => {
    setError("");
    setSyncAsk(null);
    startTransition(async () => {
      if (!initial && photos.length) {
        await saveWithPhotos(then);
        return;
      }
      const result = initial
        ? await updatePlaceAction(tripId, initial.id, draftNow, initial.stay ?? null, { asExpense: offerExpense && asExpense, expenseSync })
        : await savePlace(tripId, draftNow, then, fromDay, offerExpense && asExpense);
      if (result?.error) setError(result.error);
    });
  };

  // B15 then B15a per photo (resized first). The Place stays saved when a photo fails:
  // open its page instead, where the missing photos can be added again.
  const saveWithPhotos = async (then: "list" | "plan") => {
    const created = await createPlace(tripId, draftNow, then, fromDay, offerExpense && asExpense);
    if ("error" in created) {
      setError(created.error);
      return;
    }
    let failed = 0;
    for (const [i, photo] of photos.entries()) {
      setPhotoProgress(`${i + 1}/${photos.length}`);
      try {
        const file = await prepareImage(photo);
        if (file.size > MAX_PHOTO_BYTES) {
          failed++;
          continue;
        }
        const form = new FormData();
        form.append("file", file, file.name);
        if (await uploadPlacePhotoAction(tripId, created.placeId, form)) failed++;
      } catch {
        failed++;
      }
    }
    router.push(failed ? `/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(created.placeId)}/edit?photoFailed=${failed}` : created.next);
  };

  const remove = (withExpense: boolean) => {
    if (!initial) return;
    setError("");
    startTransition(async () => {
      const result = await deletePlaceAction(tripId, initial.id, withExpense && linked ? linked.id : undefined);
      if (result?.error) {
        setError(result.error);
        setConfirmDelete(false);
      }
    });
  };

  const stayFields = (
    <fieldset className="m-0 flex flex-col gap-3 rounded-tile border border-line bg-bg/60 p-3.5">
      <legend className={cn(fieldLabelClass, "px-1")}>รายละเอียดที่พัก</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-in`} className="text-[13px] font-semibold">
            วันเช็คอิน
          </label>
          <input
            id={`${ids}-in`}
            type="date"
            min={tripDates.start}
            max={tripDates.end}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value && checkOut && checkOut <= e.target.value) setCheckOut("");
            }}
            className={cn(fieldClass, "px-2.5")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-out`} className="text-[13px] font-semibold">
            วันเช็คเอาท์
          </label>
          <input
            id={`${ids}-out`}
            type="date"
            min={checkIn || tripDates.start}
            max={tripDates.end}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={cn(fieldClass, "px-2.5")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-price`} className="text-[13px] font-semibold">
          ราคารวมทั้งหมด (บาท)
        </label>
        <input
          id={`${ids}-price`}
          type="text"
          inputMode="decimal"
          placeholder="เช่น 5,600"
          value={price}
          onChange={(e) => {
            setPrice(formatBahtInput(e.target.value));
          }}
          className={fieldClass}
        />
        {nightsChanged ? (
          <p role="status" className="m-0 rounded-chip bg-todo-soft px-3 py-2 text-[13px] font-semibold text-todo">
            เปลี่ยนจาก {savedStay ? stayNights(savedStay) : 0} คืนเป็น {nightsNow} คืนแล้ว แต่ราคายังเป็น {formatMoney(stayPrice)} ตรวจราคา
            {linked ? "และค่าใช้จ่ายที่บันทึกไว้" : ""}ด้วยว่าถูกไหม
          </p>
        ) : null}
      </div>
      {linked ? (
        <div className="flex flex-col gap-1 rounded-chip bg-primary-soft px-3 py-2.5 text-primary-ink">
          <span className="text-sm font-semibold">บันทึกเป็นค่าใช้จ่ายแล้ว {formatMoney(linked.amount)}</span>
          {savedStay?.price && linked.amount !== savedStay.price ? (
            <span className="text-xs">ยอดค่าใช้จ่ายไม่ตรงกับราคาที่พัก {formatMoney(savedStay.price)}</span>
          ) : null}
          <Link href={`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(linked.id)}`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline">
            ดูรายการค่าใช้จ่าย
          </Link>
        </div>
      ) : null}
      {offerExpense ? (
        <button
          type="button"
          role="switch"
          aria-checked={asExpense}
          onClick={() => setAsExpenseChoice(!asExpense)}
          className={cn(
            "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-chip border-[1.5px] px-3 py-2 text-left text-ink transition-colors",
            asExpense ? "border-primary bg-primary-soft" : "border-line-strong bg-surface",
          )}
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">บันทึกเป็นค่าใช้จ่ายด้วย</span>
            <span className="text-xs text-ink-muted">คุณจ่าย {formatMoney(stayPrice)} · {stayExpenseSplitText(stayPrice, memberCount)}</span>
          </span>
          <span aria-hidden="true" className={cn("flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors duration-200", asExpense ? "justify-end bg-primary" : "justify-start bg-control")}>
            <span className="size-5 rounded-full bg-surface shadow-seg" />
          </span>
        </button>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-ref`} className="text-[13px] font-semibold">
          เลขที่จอง
        </label>
        <input id={`${ids}-ref`} type="text" maxLength={100} value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-addr`} className="text-[13px] font-semibold">
          ที่อยู่
        </label>
        <textarea id={`${ids}-addr`} rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} className={textareaClass} />
      </div>
      <p className="m-0 text-xs text-ink-muted">ใส่วันเช็คอิน–เช็คเอาท์แล้ว ระบบจะวางที่พักนี้ในแผนตามวันเหล่านั้นให้เอง</p>
    </fieldset>
  );

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

        {type === "stay" ? stayFields : null}

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

        {editing ? null : <NewPlacePhotos files={photos} onChange={setPhotos} disabled={pending} />}

        {editing ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-12 cursor-pointer self-start rounded-icon border border-line-strong bg-surface px-4 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            ลบสถานที่นี้
          </button>
        ) : (
        <button
          type="button"
          onClick={() => submit("plan")()}
          disabled={!canSave}
          className="flex min-h-[52px] cursor-pointer items-center justify-between rounded-icon border border-line bg-surface px-3.5 text-left text-ink hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">บันทึกแล้วเลือกวันที่จะไป</span>
            <span className="text-xs text-ink-muted">เพิ่มเข้าแผนรายวันต่อเลย</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        {!canSave && missing ? (
          <p className="m-0 text-center text-[13px] text-ink-muted" aria-live="polite">
            {missing}
          </p>
        ) : null}
        <Button type="submit" size="lg" block disabled={!canSave} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? (photoProgress ? `กำลังอัปโหลดรูป ${photoProgress}…` : "กำลังบันทึก…") : editing ? "บันทึกการแก้ไข" : "บันทึก"}
        </Button>
      </footer>
      {initial ? (
        <>
          <ConfirmDialog
            open={confirmDelete}
            title={`ลบ "${initial.name}"?`}
            description={
              linked
                ? linked.canEdit
                  ? `ที่พักนี้บันทึกเป็นค่าใช้จ่าย ${formatMoney(linked.amount)} ไว้ด้วย จะลบค่าใช้จ่ายนั้นไปด้วยไหม ถ้าอยู่ในแผนรายวันจะถูกเอาออกจากแผนด้วย ย้อนกลับไม่ได้`
                  : `ที่พักนี้บันทึกเป็นค่าใช้จ่าย ${formatMoney(linked.amount)} ไว้ แต่คุณไม่มีสิทธิ์ลบรายการนั้น รายการจะยังอยู่ ถ้าอยู่ในแผนรายวันจะถูกเอาออกจากแผนด้วย ย้อนกลับไม่ได้`
                : "ถ้าสถานที่นี้อยู่ในแผนรายวัน จะถูกเอาออกจากแผนด้วย ย้อนกลับไม่ได้"
            }
            confirmLabel={linked?.canEdit ? `ลบที่พักและค่าใช้จ่าย ${formatMoney(linked.amount)}` : "ลบสถานที่นี้"}
            {...(linked?.canEdit ? { secondaryLabel: "ลบเฉพาะที่พัก เก็บค่าใช้จ่ายไว้", onSecondary: () => remove(false) } : {})}
            pending={pending}
            onConfirm={() => remove(true)}
            onCancel={() => setConfirmDelete(false)}
          />
          {syncAsk && linked && newStay?.price ? (
            <ConfirmDialog
              open
              tone="primary"
              title="ค่าใช้จ่ายของที่พักนี้ล่ะ"
              description={
                syncAsk === "update"
                  ? `แก้ยอดค่าใช้จ่าย "${linked.title}" จาก ${formatMoney(linked.amount)} เป็น ${formatMoney(newStay.price)} ด้วยไหม ระบบจะหารใหม่ให้เท่ากันตามคนเดิม`
                  : syncAsk === "manual"
                    ? `ค่าใช้จ่าย "${linked.title}" (${formatMoney(linked.amount)}) หารแบบกำหนดเอง ระบบไม่เดาให้ ต้องแก้ยอดและส่วนแบ่งเอง จะบันทึกที่พักแล้วไปหน้าแก้ค่าใช้จ่ายเลยไหม`
                    : `ค่าใช้จ่าย "${linked.title}" (${formatMoney(linked.amount)}) คนอื่นเป็นคนบันทึก คุณแก้เองไม่ได้ ถ้าราคาที่พักเปลี่ยนจริง ให้บอกเจ้าของรายการหรือผู้จัดทริปแก้ด้วย`
              }
              confirmLabel={syncAsk === "update" ? "แก้ทั้งสองที่" : syncAsk === "manual" ? "บันทึกแล้วไปแก้ค่าใช้จ่าย" : "บันทึกที่พักต่อ"}
              {...(syncAsk === "locked" ? {} : { secondaryLabel: "บันทึกเฉพาะที่พัก ไม่แก้ค่าใช้จ่าย", onSecondary: () => save("list", null) })}
              cancelLabel="กลับไปแก้"
              pending={pending}
              onConfirm={() => save("list", syncAsk === "locked" ? null : syncAsk)}
              onCancel={() => setSyncAsk(null)}
            />
          ) : null}
        </>
      ) : null}
    </form>
  );
}
