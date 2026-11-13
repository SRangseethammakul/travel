"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  /** Close when the dimmed backdrop is tapped (off for confirmations). */
  dismissOnBackdrop?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared base for BottomSheet and ConfirmDialog: a native <dialog> opened with
 * showModal(), so focus is trapped, the page behind is inert and Escape closes
 * it. Mark the initial focus target with `data-autofocus`. It slides up from the bottom of the app frame (max 640px).
 */
export function Sheet({ open, onClose, role = "dialog", labelledBy, describedBy, dismissOnBackdrop = true, className, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first control; honour an explicit initial focus instead.
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-app overflow-y-auto rounded-t-trip border-0 bg-surface p-0 text-ink shadow-sheet",
        "backdrop:bg-ink/45 open:animate-sheet-in open:backdrop:animate-fade-in",
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  );
}
