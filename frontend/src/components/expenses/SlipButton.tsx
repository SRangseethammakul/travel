"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatFileSize } from "./SlipPicker";

interface SlipButtonProps {
  name: string;
  size: number;
  mime: string;
  /** Button text, e.g. "ดูใบเสร็จ". */
  label: string;
  /** Signed link from B13 (short-lived, made when the page renders); null when it could not be made. */
  url: string | null;
}

/**
 * Opens an attached slip/receipt: a sheet with the file details and a link that
 * opens the private file through its signed URL (B13).
 */
export function SlipButton({ name, size, mime, label, url }: SlipButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-chip border border-line bg-surface py-1 pr-2.5 pl-1 text-[13px] font-semibold text-ink transition-colors hover:bg-bg"
      >
        <span aria-hidden="true" className="h-9 w-[34px] rounded-lg border border-line-strong bg-[repeating-linear-gradient(180deg,var(--color-line-soft)_0_5px,var(--color-surface)_5px_9px)]" />
        {label}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <div className="flex flex-col gap-2">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ block: true })}>
                <Icon name={mime === "application/pdf" ? "doc" : "image"} size={18} />
                เปิดไฟล์
              </a>
            ) : null}
            <Button variant="soft" block onClick={() => setOpen(false)} data-autofocus>
              ปิด
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 rounded-icon bg-bg p-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-chip bg-surface text-primary">
            <Icon name={mime === "application/pdf" ? "doc" : "image"} size={22} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{name}</span>
            <span className="text-[13px] text-ink-muted">
              {mime === "application/pdf" ? "PDF" : "รูปภาพ"} · {formatFileSize(size)}
            </span>
          </span>
        </div>
        <p className="m-0 text-[13px] text-ink-muted">
          {url
            ? "ไฟล์เก็บแบบส่วนตัว ลิงก์เปิดได้ชั่วคราว ถ้าเปิดไม่ได้ให้โหลดหน้านี้ใหม่"
            : "เปิดไฟล์ไม่ได้ในขณะนี้ ลองโหลดหน้านี้ใหม่"}
        </p>
      </BottomSheet>
    </>
  );
}
