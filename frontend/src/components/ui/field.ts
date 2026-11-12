import { cn } from "@/lib/cn";

/** 48px text field on white (mockup inputs: 1px #D5DDE3 border, radius 14). */
export const fieldClass =
  "h-12 w-full rounded-icon border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors hover:border-ink-muted focus-visible:border-primary";

/** Multi-line version of fieldClass. */
export const textareaClass = cn(fieldClass, "h-auto min-h-20 resize-none py-3 leading-normal");

/** Form section label (14px semibold). */
export const fieldLabelClass = "text-sm font-semibold";

/**
 * Pill used for single-choice options. "ink" (city, area, transit mode) fills dark;
 * "primary" (ManageTags "ย้ายไปกลุ่ม") uses the soft teal of the mockup.
 */
export function pillClass(on: boolean, tone: "ink" | "primary" = "ink") {
  return cn(
    "relative inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors duration-150",
    "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
    !on
      ? "border-line-strong bg-surface text-ink hover:border-ink-muted"
      : tone === "primary"
        ? "border-primary bg-primary-soft text-primary-ink"
        : "border-ink bg-ink text-surface",
  );
}

/** Dashed "+ new" pill. */
export const addPillClass =
  "relative inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-dashed border-control bg-transparent px-3 text-sm font-medium text-ink hover:border-ink-muted before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']";
