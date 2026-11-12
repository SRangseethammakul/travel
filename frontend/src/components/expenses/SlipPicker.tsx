"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MAX_SLIP_BYTES } from "@/lib/expense-draft";

export function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface SlipPickerProps {
  /** Currently attached slip (name + optional size for a new pick). */
  value: { name: string; size?: number } | null;
  /** The picked file; the Server Action uploads it (B12). */
  onPick: (file: File) => void;
  onRemove: () => void;
  /** Dashed button text, e.g. "แนบสลิปการโอน (ไม่บังคับ)". */
  label: string;
}

/**
 * Attach a transfer slip (image or PDF ≤ 10 MB, the backend's upload limit and
 * below Next's 11 MB Server Action body limit). The File goes to the Server
 * Action, which uploads it to private storage.
 */
export function SlipPicker({ value, onPick, onRemove, label }: SlipPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SLIP_BYTES || !/^(image\/|application\/pdf$)/.test(file.type)) {
      setError("แนบได้เฉพาะรูปหรือ PDF ขนาดไม่เกิน 10 MB");
      return;
    }
    setError("");
    onPick(file);
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex min-h-12 items-center gap-2.5 rounded-icon border border-line bg-surface-alt pr-1 pl-3 text-sm">
          <Icon name="image" size={18} className="shrink-0 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{value.name}</span>
            <span className="text-xs text-ink-muted">{value.size ? `แนบสลิปแล้ว · ${formatFileSize(value.size)}` : "สลิปที่แนบไว้"}</span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`เอาสลิป ${value.name} ออก`}
            className="min-h-11 shrink-0 cursor-pointer rounded-chip border-0 bg-transparent px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            เอาออก
          </button>
        </div>
      ) : (
        <Button variant="dashed" block icon={<Icon name="image" size={18} />} onClick={() => fileRef.current?.click()} className="text-sm">
          {label}
        </Button>
      )}
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
