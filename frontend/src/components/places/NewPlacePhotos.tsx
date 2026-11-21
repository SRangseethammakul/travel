"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { clipboardImageFiles, MAX_PLACE_PHOTOS, pastedImageFiles, photoSlotsLeft } from "@/lib/place-photos";

interface NewPlacePhotosProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** While the form saves / uploads. */
  disabled?: boolean;
}

const noSubscribe = () => () => {};
const hasClipboardRead = () => typeof navigator.clipboard?.read === "function";

const tile = "relative aspect-square w-full overflow-hidden rounded-chip bg-line-soft";

/**
 * Photos picked on AddPlace, before the Place exists: previews only. PlaceForm uploads
 * them one by one (B15a) after the Place is saved. Same look as `PlacePhotos`.
 */
export function NewPlacePhotos({ files, onChange, disabled = false }: NewPlacePhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  /** `navigator.clipboard.read` exists (Safari iOS 13.4+, Chrome; https or localhost only). False on the server. */
  const canReadClipboard = useSyncExternalStore(noSubscribe, hasClipboardRead, () => false);

  // One object URL per picked file; freed when the file is removed or the page is left.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const slots = photoSlotsLeft(files.length, 0);
  const full = slots === 0;

  const addFiles = (picked: File[]) => {
    if (!picked.length) return;
    const taken = picked.slice(0, slots);
    setNotice(
      taken.length < picked.length
        ? slots === 0
          ? "ครบ 10 รูปแล้ว"
          : `เพิ่มได้อีก ${slots} รูป จึงเลือกให้ ${slots} รูปแรก (รวมไม่เกิน ${MAX_PLACE_PHOTOS} รูป)`
        : "",
    );
    if (taken.length) onChange([...files, ...taken]);
  };

  const onPick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    addFiles(picked);
  };

  // Paste anywhere on the page (Cmd/Ctrl+V, or iOS "Paste" in a text field). Text pastes pass through.
  const onPastedFiles = useEffectEvent((picked: File[]) => addFiles(picked));
  const acceptsPaste = !disabled && !full;
  useEffect(() => {
    if (!acceptsPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const picked = pastedImageFiles(e.clipboardData?.files ?? []);
      if (!picked.length) return;
      e.preventDefault();
      onPastedFiles(picked);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [acceptsPaste]);

  // iOS: tapping this shows the system "Paste" bubble; the read must start inside the tap.
  const pasteFromClipboard = async () => {
    try {
      const picked = await clipboardImageFiles(await navigator.clipboard.read());
      if (picked.length) addFiles(picked);
      else setNotice("ไม่พบรูปในคลิปบอร์ด คัดลอกรูปก่อน แล้วกดวางรูปอีกครั้ง");
    } catch (err) {
      // NotAllowedError = the user dismissed the Paste bubble or denied access: nothing to say.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) setNotice("อ่านคลิปบอร์ดไม่ได้ ใช้ปุ่มเพิ่มรูปแทน");
    }
  };

  const remove = (i: number) => {
    setNotice("");
    onChange(files.filter((_, j) => j !== i));
  };

  return (
    <section aria-labelledby="new-place-photos" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="new-place-photos" className="m-0 text-[15px] font-semibold">
          รูปภาพ (ไม่บังคับ)
        </h2>
        <span className="text-xs text-ink-muted">
          {files.length}/{MAX_PLACE_PHOTOS}
        </span>
      </div>

      {files.length ? (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {files.map((f, i) => (
            <li key={previews[i]} className={tile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt="" className="absolute inset-0 size-full object-cover" />
              <button
                type="button"
                aria-label={`เอารูป ${f.name} ออก`}
                disabled={disabled}
                onClick={() => remove(i)}
                className="absolute top-0 right-0 flex size-11 cursor-pointer items-start justify-end border-0 bg-transparent p-1.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-ink/60 text-surface">
                  <Icon name="close" size={12} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[13px] text-ink-muted">เพิ่มรูปของสถานที่นี้ให้เพื่อนร่วมทริปดู รูปจะอัปโหลดตอนกดบันทึก</p>
      )}

      {notice ? (
        <p role="status" className="m-0 text-[13px] text-todo">
          {notice}
        </p>
      ) : null}

      {full ? (
        <p className="m-0 flex min-h-11 items-center justify-center rounded-icon bg-bg text-sm font-semibold text-ink-muted">ครบ 10 รูปแล้ว</p>
      ) : (
        <>
          <input ref={inputRef} type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" className="sr-only" onChange={(e) => onPick(e.target.files)} />
          <div className={cn("grid gap-2", canReadClipboard ? "grid-cols-2" : "grid-cols-1")}>
            <Button variant="dashed" size="sm" block disabled={disabled} icon={<Icon name="image" size={20} />} onClick={() => inputRef.current?.click()}>
              เพิ่มรูป
            </Button>
            {canReadClipboard ? (
              <Button variant="dashed" size="sm" block disabled={disabled} icon={<Icon name="paste" size={20} />} onClick={() => void pasteFromClipboard()}>
                วางรูป
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
