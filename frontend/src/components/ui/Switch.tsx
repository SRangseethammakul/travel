"use client";

import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

/** On/off switch with a visible text label (Places "ยังไม่จัดวัน"). The hit area is padded to 44px. */
export function Switch({ checked, onChange, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex min-h-9 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-medium text-ink",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-[34px] shrink-0 rounded-full p-0.5 transition-colors duration-200",
          checked ? "justify-end bg-primary" : "justify-start bg-control",
        )}
      >
        <span className="size-4 rounded-full bg-surface shadow-seg" />
      </span>
      {label}
    </button>
  );
}
