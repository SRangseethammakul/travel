"use client";

import { useId } from "react";
import { Chip } from "@/components/ui/Chip";
import { fieldClass } from "@/components/ui/field";
import { cardNameChips, MAX_CARD_NAME } from "@/lib/card-name";

interface CardNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Card names already used in this trip; shown first as quick picks. */
  usedNames: readonly string[];
}

/** Card name input (optional) with quick-pick chips: names used in the trip, then common Thai banks. Shown when the method is card. */
export function CardNameField({ value, onChange, usedNames }: CardNameFieldProps) {
  const id = useId();
  const chips = cardNameChips(usedNames);
  const current = value.trim();

  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      <label htmlFor={`${id}-card`} className="text-[13px] text-ink-muted">
        ชื่อบัตร (ไม่บังคับ)
      </label>
      <input
        id={`${id}-card`}
        type="text"
        autoComplete="off"
        maxLength={MAX_CARD_NAME}
        placeholder="เช่น UOB PRVI"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
      <div role="group" aria-label="เลือกชื่อบัตร" className="mt-1 flex flex-wrap gap-2">
        {chips.map((name) => (
          <Chip key={name} tone="ink" selected={current === name} onClick={() => onChange(current === name ? "" : name)}>
            {name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
