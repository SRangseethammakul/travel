"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** Optional count shown after the label ("Tokyo 9"). */
  count?: number;
  /** Optional second line under the label (city tabs: "9 ที่"). */
  sublabel?: string;
  /** When set, the option is a link (state lives in searchParams). */
  href?: string;
}

const sizes = {
  /** Full-width tabs: Trips status, city tabs, checklist scope. */
  md: { track: "gap-1 rounded-icon p-1", item: "min-h-10 rounded-[10px] px-2 text-sm before:-inset-y-0.5" },
  /** Two-line city tabs (PlacesJP): 44px tall, 13px label. */
  city: { track: "gap-1 rounded-icon p-1", item: "min-h-11 rounded-[10px] px-1 text-[13px]" },
  /** Compact switch: "ตามย่าน / ตามประเภท". */
  sm: { track: "gap-0.5 rounded-[10px] p-[3px]", item: "min-h-8 rounded-lg px-2.5 text-xs before:-inset-y-1.5" },
} as const;

interface SegmentedProps<V extends string> {
  options: readonly SegmentedOption<V>[];
  value: V;
  /** Used for button options. Not needed when every option has an `href`. */
  onChange?: (value: V) => void;
  /** Accessible name of the group, e.g. "สถานะทริป". */
  label: string;
  size?: keyof typeof sizes;
  /** Stretch options to equal widths. */
  fill?: boolean;
  className?: string;
}

/**
 * Segmented control. Button options form a radiogroup; link options mark the
 * current one with aria-current. Hit areas are padded to 44px with ::before.
 */
export function Segmented<V extends string>({ options, value, onChange, label, size = "md", fill = true, className }: SegmentedProps<V>) {
  const s = sizes[size];
  const isLinks = options.every((o) => o.href);
  const itemClass = (on: boolean) =>
    cn(
      "relative inline-flex cursor-pointer items-center justify-center border-0 font-semibold no-underline transition-[background-color,color,box-shadow] duration-200 ease-out",
      "before:absolute before:inset-x-0 before:content-['']",
      s.item,
      fill && "flex-1",
      on ? "bg-surface text-ink shadow-seg hover:text-ink" : "bg-transparent text-ink-soft hover:text-ink",
    );
  const content = (o: SegmentedOption<V>) =>
    o.sublabel ? (
      <span className="flex flex-col items-center leading-tight">
        <span>{o.label}</span>
        <span className="text-[11px] font-medium opacity-80">{o.sublabel}</span>
      </span>
    ) : (
      <>
        {o.label}
        {o.count !== undefined ? <span className="ml-1 tabular-nums">{o.count}</span> : null}
      </>
    );

  return (
    <div
      role={isLinks ? "group" : "radiogroup"}
      aria-label={label}
      className={cn("flex bg-line", s.track, !fill && "w-fit", className)}
    >
      {options.map((o) =>
        isLinks ? (
          <Link key={o.value} href={o.href!} aria-current={o.value === value ? "page" : undefined} className={itemClass(o.value === value)} scroll={false}>
            {content(o)}
          </Link>
        ) : (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange?.(o.value)}
            className={itemClass(o.value === value)}
          >
            {content(o)}
          </button>
        ),
      )}
    </div>
  );
}
