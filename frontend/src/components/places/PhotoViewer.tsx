"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PlacePhoto } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { PlacePhotoImg } from "./PlacePhotoImg";

interface PhotoViewerProps {
  photos: PlacePhoto[];
  index: number;
  placeName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Present when the current Member may delete this photo. */
  onDelete?: (photo: PlacePhoto) => void;
}

const round = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-surface/15 text-surface transition-colors hover:bg-surface/25 active:bg-surface/30 disabled:cursor-default disabled:opacity-0";

/**
 * Full-screen viewer: a native <dialog> (focus trap, Escape) with a scroll-snap
 * track, so a swipe works with the browser's own touch handling. Prev / next
 * buttons and arrow keys scroll the same track. Mounted only while open.
 */
export function PhotoViewer({ photos, index, placeName, onIndexChange, onClose, onDelete }: PhotoViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const last = photos.length - 1;
  const current = photos[Math.min(index, last)];

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Keep the track on `index` (first paint: instantly; later: smoothly, e.g. after a delete or a button).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const now = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (now !== index) track.scrollTo({ left: index * track.clientWidth, behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [index, photos.length]);

  const go = (next: number) => onIndexChange(Math.min(last, Math.max(0, next)));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
  };

  if (!current) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col border-0 bg-ink p-0 text-surface open:flex open:animate-fade-in"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <h2 id={titleId} className="m-0 min-w-0 truncate text-sm font-semibold">
          <span className="sr-only">รูปของ {placeName} </span>
          {index + 1} / {photos.length}
        </h2>
        <div className="flex items-center gap-2">
          {onDelete ? (
            <button type="button" onClick={() => onDelete(current)} className={cn(round, "w-auto gap-1.5 px-3.5 text-sm font-semibold")}>
              <Icon name="trash" size={18} aria-hidden="true" />
              ลบรูปนี้
            </button>
          ) : null}
          <button type="button" aria-label="ปิดรูป" onClick={onClose} data-autofocus className={round}>
            <Icon name="close" size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const t = e.currentTarget;
            const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
            if (i !== index && i >= 0 && i <= last) onIndexChange(i);
          }}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((p, i) => (
            <div key={p.id} className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-1 pb-[max(12px,env(safe-area-inset-bottom))]">
              <PlacePhotoImg
                photo={p}
                alt={`รูปที่ ${i + 1} ของ ${placeName}`}
                brokenLabel="เปิดรูปนี้ไม่ได้ในเบราว์เซอร์นี้"
                className="size-full object-contain"
              />
            </div>
          ))}
        </div>
        {photos.length > 1 ? (
          <>
            <button type="button" aria-label="รูปก่อนหน้า" disabled={index === 0} onClick={() => go(index - 1)} className={cn(round, "absolute top-1/2 left-2 -translate-y-1/2 bg-ink/50")}>
              <Icon name="back" size={22} aria-hidden="true" />
            </button>
            <button type="button" aria-label="รูปถัดไป" disabled={index === last} onClick={() => go(index + 1)} className={cn(round, "absolute top-1/2 right-2 -translate-y-1/2 bg-ink/50")}>
              <Icon name="chevronRight" size={22} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
