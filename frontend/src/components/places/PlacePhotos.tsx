"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { deletePlacePhotoAction, uploadPlacePhotoAction } from "@/lib/api/place-photo-actions";
import type { ID, Member, PlacePhoto } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { prepareImage } from "@/lib/image-resize";
import { canAddPlacePhoto, canDeletePlacePhoto } from "@/lib/permissions";
import {
  clipboardImageFiles,
  MAX_PHOTO_BYTES,
  MAX_PLACE_PHOTOS,
  pastedImageFiles,
  photoErrorMessage,
  photoSlotsLeft,
  refreshDelay,
} from "@/lib/place-photos";
import { PhotoViewer } from "./PhotoViewer";
import { PlacePhotoImg, requestFreshPhotoLinks } from "./PlacePhotoImg";

interface PlacePhotosProps {
  tripId: ID;
  placeId: ID;
  placeName: string;
  photos: PlacePhoto[];
  me: Pick<Member, "id" | "role">;
  className?: string;
}

interface Pending {
  key: number;
  file: File;
  /** Object URL of the picked file, for the preview (may not render, e.g. HEIC outside Safari). */
  preview: string;
  status: "queued" | "uploading" | "error";
  error?: string;
}

const noSubscribe = () => () => {};
const hasClipboardRead = () => typeof navigator.clipboard?.read === "function";

const tile = "relative aspect-square w-full overflow-hidden rounded-chip bg-line-soft";

/**
 * Photos of a Place: thumbnail grid, full-screen viewer, add (owner / editor) and
 * delete (owner / the uploader). The saved photos come from props, so the page
 * refresh after every Server Action is the only source of truth; uploads in flight
 * and their errors live here.
 */
export function PlacePhotos({ tripId, placeId, placeName, photos, me, className }: PlacePhotosProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const queueRef = useRef<Pending[]>([]);
  const running = useRef(false);
  const nextKey = useRef(1);
  const [notice, setNotice] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<PlacePhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  /** `navigator.clipboard.read` exists (Safari iOS 13.4+, Chrome; https or localhost only). False on the server. */
  const canReadClipboard = useSyncExternalStore(noSubscribe, hasClipboardRead, () => false);

  const canAdd = canAddPlacePhoto(me);
  const inFlight = queue.filter((q) => q.status !== "error").length;
  const slots = photoSlotsLeft(photos.length, inFlight);
  const full = photos.length >= MAX_PLACE_PHOTOS;

  const commit = (next: Pending[]) => {
    queueRef.current = next;
    setQueue(next);
  };
  const patch = (key: number, change: Partial<Pending>) => commit(queueRef.current.map((q) => (q.key === key ? { ...q, ...change } : q)));
  const drop = (key: number) => {
    const gone = queueRef.current.find((q) => q.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    commit(queueRef.current.filter((q) => q.key !== key));
  };

  // Signed links expire ~15 min after the page was fetched: re-fetch just before.
  const expiryKey = useMemo(() => photos.map((p) => p.urlExpiresAt).join("|"), [photos]);
  useEffect(() => {
    const wait = refreshDelay(photos, Date.now());
    if (wait === null) return;
    const t = setTimeout(() => requestFreshPhotoLinks(router), wait);
    return () => clearTimeout(t);
    // `expiryKey` stands for `photos`: re-arm only when the links change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryKey, router]);

  // Free the preview URLs when leaving the page.
  useEffect(
    () => () => {
      for (const q of queueRef.current) URL.revokeObjectURL(q.preview);
    },
    [],
  );

  // One file at a time: resize, upload, then the page refresh brings the saved photo in.
  const drain = async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (let item = queueRef.current.find((q) => q.status === "queued"); item; item = queueRef.current.find((q) => q.status === "queued")) {
        const { key } = item;
        patch(key, { status: "uploading" });
        const file = await prepareImage(item.file);
        if (file.size > MAX_PHOTO_BYTES) {
          patch(key, { status: "error", error: photoErrorMessage("file_too_large") });
          continue;
        }
        const form = new FormData();
        form.append("file", file, file.name);
        try {
          const result = await uploadPlacePhotoAction(tripId, placeId, form);
          if (result) patch(key, { status: "error", error: photoErrorMessage(result.code, result.error) });
          else drop(key);
        } catch {
          // The request itself failed (offline, or the body was refused before reaching the backend).
          patch(key, { status: "error", error: "อัปโหลดไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่" });
        }
      }
    } finally {
      running.current = false;
    }
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const room = photoSlotsLeft(photos.length, queueRef.current.filter((q) => q.status !== "error").length);
    const taken = files.slice(0, room);
    setNotice(
      taken.length < files.length
        ? room === 0
          ? "ครบ 10 รูปแล้ว"
          : `เพิ่มได้อีก ${room} รูป จึงเลือกให้ ${room} รูปแรก (รวมไม่เกิน ${MAX_PLACE_PHOTOS} รูป)`
        : "",
    );
    if (!taken.length) return;
    commit([...queueRef.current, ...taken.map((file): Pending => ({ key: nextKey.current++, file, preview: URL.createObjectURL(file), status: "queued" }))]);
    void drain();
  };

  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    addFiles(files);
  };

  // Paste anywhere on the page (Cmd/Ctrl+V, or iOS "Paste" in a text field). Text pastes pass through.
  const onPastedFiles = useEffectEvent((files: File[]) => addFiles(files));
  const acceptsPaste = canAdd && !full;
  useEffect(() => {
    if (!acceptsPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = pastedImageFiles(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      onPastedFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [acceptsPaste]);

  // iOS: tapping this shows the system "Paste" bubble; the read must start inside the tap.
  const pasteFromClipboard = async () => {
    try {
      const files = await clipboardImageFiles(await navigator.clipboard.read());
      if (files.length) addFiles(files);
      else setNotice("ไม่พบรูปในคลิปบอร์ด คัดลอกรูปก่อน แล้วกดวางรูปอีกครั้ง");
    } catch (err) {
      // NotAllowedError = the user dismissed the Paste bubble or denied access: nothing to say.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) setNotice("อ่านคลิปบอร์ดไม่ได้ ใช้ปุ่มเพิ่มรูปแทน");
    }
  };

  const retry = (key: number) => {
    patch(key, { status: "queued", error: undefined });
    void drain();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    const result = await deletePlacePhotoAction(tripId, placeId, toDelete.id).catch(() => ({ error: "ลบรูปไม่สำเร็จ กรุณาลองใหม่" }));
    setDeleting(false);
    setToDelete(null);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    // The photo is gone from props once the page refreshes; keep the viewer on a valid photo meanwhile.
    setViewing((v) => (v === null ? v : photos.length <= 1 ? null : Math.min(v, photos.length - 2)));
  };

  const errors = queue.filter((q) => q.status === "error");
  const uploading = queue.filter((q) => q.status !== "error");
  const deletable = (p: PlacePhoto) => canDeletePlacePhoto(me, p);
  const viewerPhoto = viewing === null ? null : photos[Math.min(viewing, photos.length - 1)];

  return (
    <section aria-labelledby={`photos-${placeId}`} className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`photos-${placeId}`} className="m-0 text-[15px] font-semibold">
          รูปภาพ
        </h2>
        <span className="text-xs text-ink-muted">
          {photos.length}/{MAX_PLACE_PHOTOS}
        </span>
      </div>

      {photos.length || uploading.length ? (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                aria-label={`ดูรูปที่ ${i + 1} จาก ${photos.length}`}
                onClick={() => setViewing(i)}
                className={cn(tile, "block cursor-pointer border-0 p-0 transition-opacity active:opacity-80")}
              >
                <PlacePhotoImg photo={p} alt="" className="absolute inset-0 size-full object-cover" />
              </button>
            </li>
          ))}
          {uploading.map((q) => (
            <li key={q.key} aria-busy="true" className={tile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.preview} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/25 text-surface">
                {q.status === "uploading" ? (
                  <span aria-hidden="true" className="size-6 animate-spin rounded-full border-[3px] border-surface/40 border-t-surface motion-reduce:animate-none" />
                ) : null}
                <span className="rounded-full bg-ink/60 px-2 py-0.5 text-xs font-semibold">{q.status === "uploading" ? "กำลังอัปโหลด" : "รอคิว"}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : canAdd ? (
        <p className="m-0 text-[13px] text-ink-muted">ยังไม่มีรูป เพิ่มรูปของสถานที่นี้ให้เพื่อนร่วมทริปดู</p>
      ) : null}

      {errors.map((q) => (
        <div key={q.key} role="alert" className="flex items-center gap-2.5 rounded-chip bg-danger-soft p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.preview} alt="" className="size-11 shrink-0 rounded-[10px] bg-line-soft object-cover" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs text-ink-subtle">{q.file.name}</span>
            <span className="text-[13px] font-semibold text-danger-ink">{q.error}</span>
          </div>
          <button type="button" onClick={() => retry(q.key)} className="min-h-11 shrink-0 cursor-pointer border-0 bg-transparent px-2 text-[13px] font-semibold text-danger-ink underline">
            ลองใหม่
          </button>
          <button type="button" aria-label={`ปิดข้อความของ ${q.file.name}`} onClick={() => drop(q.key)} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-danger-ink">
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}

      {deleteError ? (
        <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
          {deleteError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="m-0 text-[13px] text-todo">
          {notice}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {uploading.length ? `กำลังอัปโหลดรูป ${uploading.length} รูป` : ""}
      </p>

      {canAdd ? (
        full ? (
          <p className="m-0 flex min-h-11 items-center justify-center rounded-icon bg-bg text-sm font-semibold text-ink-muted">ครบ 10 รูปแล้ว</p>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => onPick(e.target.files)}
            />
            <div className={cn("grid gap-2", canReadClipboard ? "grid-cols-2" : "grid-cols-1")}>
              <Button variant="dashed" size="sm" block disabled={slots === 0} icon={<Icon name="image" size={20} />} onClick={() => inputRef.current?.click()}>
                เพิ่มรูป
              </Button>
              {canReadClipboard ? (
                <Button variant="dashed" size="sm" block disabled={slots === 0} icon={<Icon name="paste" size={20} />} onClick={() => void pasteFromClipboard()}>
                  วางรูป
                </Button>
              ) : null}
            </div>
          </>
        )
      ) : null}

      {viewing !== null && viewerPhoto ? (
        <PhotoViewer
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          placeName={placeName}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          {...(deletable(viewerPhoto) ? { onDelete: setToDelete } : {})}
        />
      ) : null}
      <ConfirmDialog
        open={toDelete !== null}
        title="ลบรูปนี้?"
        description="รูปจะถูกลบออกจากสถานที่นี้ และกู้คืนไม่ได้"
        confirmLabel="ลบรูป"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
