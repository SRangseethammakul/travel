import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Chips stay 36–40px tall as in the mockups; an invisible ::before extends the
 * hit area to at least 44px (SPEC: touch targets ≥ 44px).
 */
const hitArea = "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']";

const sizes = {
  sm: "min-h-9 px-3 text-[13px]", // 36 — tag filters
  md: "min-h-10 px-3.5 text-sm", // 40 — category / mode pills
} as const;

const tones = {
  /** Selected = teal fill (tag filters, PickPlace days). */
  primary: {
    on: "border-primary bg-primary text-surface hover:bg-primary-hover",
    off: "border-line-strong bg-surface text-ink hover:border-ink-muted",
  },
  /** Selected = ink fill (categories, travel modes, expiry). */
  ink: {
    on: "border-ink bg-ink text-surface",
    off: "border-line-strong bg-surface text-ink hover:border-ink-muted",
  },
} as const;

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected: boolean;
  /** `toggle` → aria-pressed (multi-select). `radio` → role=radio + aria-checked (single choice inside a radiogroup). */
  kind?: "toggle" | "radio";
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  children: ReactNode;
}

export function Chip({ selected, kind = "toggle", tone = "primary", size = "md", className, children, type = "button", ...rest }: ChipProps) {
  const a11y = kind === "radio" ? { role: "radio" as const, "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      type={type}
      {...a11y}
      className={cn(
        hitArea,
        "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] font-semibold whitespace-nowrap transition-colors duration-150",
        sizes[size],
        selected ? tones[tone].on : tones[tone].off,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Non-interactive "#tag" label on place rows. */
export function TagLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full bg-bg px-2 py-px text-xs text-ink-subtle", className)}>#{children}</span>
  );
}

/** Small status pill, e.g. category on ExpenseDetail or "รอยืนยัน". */
export function Pill({ tone = "primary", children, className }: { tone?: "primary" | "todo" | "danger" | "neutral"; children: ReactNode; className?: string }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary-ink",
    todo: "bg-todo-soft text-todo",
    danger: "bg-danger-soft text-danger-ink",
    neutral: "bg-bg text-ink-subtle",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold", toneClass, className)}>{children}</span>;
}
