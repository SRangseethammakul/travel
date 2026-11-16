"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface AddToTripEntry {
  href: string;
  icon: IconName;
  label: string;
  hint: string;
}

/** The green + on the trip page: opens a sheet of things to add to THIS trip. */
export function AddToTripMenu({ entries }: { entries: AddToTripEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  return (
    <>
      <button
        type="button"
        aria-label="เพิ่มในทริปนี้"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-icon border-0 bg-primary text-surface transition-colors duration-150 hover:bg-primary-hover active:bg-primary-ink"
      >
        <Icon name="plus" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="เพิ่มในทริปนี้">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {entries.map((e, i) => (
            <li key={e.href}>
              <Link
                href={e.href}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => setOpen(false)}
                className={cn("flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-ink no-underline hover:bg-bg hover:text-ink")}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-primary-soft text-primary">
                  <Icon name={e.icon} size={20} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{e.label}</span>
                  <span className="text-[13px] text-ink-muted">{e.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
