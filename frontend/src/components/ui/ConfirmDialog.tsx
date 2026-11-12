"use client";

import { useId } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for deletes (every delete needs this dialog). */
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation sheet (ExpenseDetail delete). Focus starts on "ยกเลิก" so Enter never deletes by accident. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "ยกเลิก",
  tone = "danger",
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <Sheet open={open} onClose={onCancel} role="alertdialog" labelledBy={titleId} describedBy={descId} dismissOnBackdrop={false}>
      <div className="flex flex-col gap-2.5 px-5 pt-6 pb-[calc(32px+env(safe-area-inset-bottom))]">
        <h2 id={titleId} className="m-0 font-display text-lg font-semibold">
          {title}
        </h2>
        <p id={descId} className="m-0 mb-1.5 text-sm leading-[1.55] text-ink-subtle">
          {description}
        </p>
        <Button variant={tone} size="lg" block onClick={onConfirm} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "กำลังดำเนินการ…" : confirmLabel}
        </Button>
        <Button variant="soft" block onClick={onCancel} data-autofocus>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
