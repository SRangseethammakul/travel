"use client";

import { useRef, useState, useTransition } from "react";
import { formatFileSize } from "@/components/expenses/SlipPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { removeDocumentAction } from "@/lib/api/document-actions";
import { uploadTripDocument } from "@/lib/api/plan-actions";
import type { ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fileBaseName, isAllowedDocument } from "@/lib/trip-form";

export interface DocumentRow {
  id: ID;
  name: string;
  mime: string;
  size: number;
  uploaderName: string;
  /** Signed link (B13), or null when it could not be made. */
  url: string | null;
  canDelete: boolean;
}

/** Trip documents: open, delete (owner / uploader), upload (editor+). Self-designed — no mockup. */
export function DocumentList({ tripId, rows, canUpload }: { tripId: ID; rows: DocumentRow[]; canUpload: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<DocumentRow | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const upload = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (list.some((f) => !isAllowedDocument(f.type, f.size))) {
      setError("แนบได้เฉพาะ PDF หรือรูป ขนาดไม่เกิน 10 MB");
      return;
    }
    startTransition(async () => {
      setError("");
      for (const f of list) {
        const form = new FormData();
        form.append("file", f, f.name);
        form.append("name", fileBaseName(f.name).slice(0, 120));
        const r = await uploadTripDocument(tripId, form);
        if ("error" in r) {
          setError(r.error);
          return;
        }
      }
    });
  };

  const remove = () => {
    if (!removing) return;
    startTransition(async () => {
      setError("");
      const result = await removeDocumentAction(tripId, removing.id);
      setRemoving(null);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <>
      {error ? (
        <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}

      {rows.length ? (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
          {rows.map((d) => {
            const pdf = d.mime === "application/pdf";
            return (
              <li key={d.id} className="flex min-h-16 items-center gap-3 border-b border-line-soft py-2 pr-2 pl-3.5 last:border-b-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-12 w-[42px] shrink-0 items-center justify-center rounded-[10px] font-display text-[11px] font-bold tracking-wide",
                    pdf ? "bg-danger-soft text-danger" : "bg-interest-soft text-type-interest",
                  )}
                >
                  {pdf ? "PDF" : "IMG"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center truncate font-semibold">
                      {d.name}
                    </a>
                  ) : (
                    <span className="truncate font-semibold">{d.name}</span>
                  )}
                  <span className="truncate text-xs text-ink-muted">
                    {formatFileSize(d.size)} · อัปโหลดโดย {d.uploaderName}
                  </span>
                </span>
                {d.canDelete ? (
                  <button
                    type="button"
                    aria-label={`ลบ ${d.name}`}
                    disabled={pending}
                    onClick={() => setRemoving(d)}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-icon border-0 bg-transparent text-ink-muted hover:bg-bg hover:text-danger disabled:cursor-wait"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 rounded-tile bg-surface px-4 py-5 text-center text-sm text-ink-muted">
          ยังไม่มีเอกสาร{canUpload ? " อัปโหลดตั๋วหรือใบจองไว้ให้ทุกคนเปิดดูได้" : ""}
        </p>
      )}

      {canUpload ? (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary-wash text-sm font-semibold text-primary hover:bg-primary-soft disabled:cursor-wait disabled:opacity-60"
          >
            <Icon name="plus" size={18} />
            {pending ? "กำลังบันทึก…" : "อัปโหลดไฟล์ (PDF หรือรูปภาพ)"}
          </button>
        </>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={`ลบ ${removing?.name ?? ""}?`}
        description="ทุกคนในทริปจะเปิดไฟล์นี้ไม่ได้อีก และไฟล์จะหายจากการเดินทางที่แนบไว้"
        confirmLabel="ลบเอกสาร"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
