"use client";

import { useId, type ReactNode } from "react";
import { Sheet } from "./Sheet";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small muted line above the title (e.g. "การเดินทาง"). */
  caption?: string;
  children: ReactNode;
  /** Buttons row at the bottom. */
  footer?: ReactNode;
}

/** Panel that slides up from the bottom (travel hop editor, role picker, settings). */
export function BottomSheet({ open, onClose, title, caption, children, footer }: BottomSheetProps) {
  const titleId = useId();
  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="mx-auto -mt-2 mb-0.5 h-1 w-9 rounded-full bg-line-strong" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
          <h2 id={titleId} className="m-0 font-display text-[17px] leading-[1.35] font-semibold">
            {title}
          </h2>
        </div>
        {children}
        {footer}
      </div>
    </Sheet>
  );
}
