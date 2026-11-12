"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { markRead } from "@/lib/api/activity-actions";
import type { ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** Row link that marks the item read before opening it. */
export function ActivityLink({ tripId, id, unread, href, className, children }: { tripId: ID; id: ID; unread: boolean; href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        startTransition(async () => {
          if (unread) await markRead(tripId, [id]);
          router.push(href);
        });
      }}
    >
      {children}
    </Link>
  );
}

export function MarkAllReadButton({ tripId, disabled }: { tripId: ID; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => startTransition(async () => void (await markRead(tripId)))}
      className="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[13px] font-semibold text-primary hover:text-primary-hover disabled:cursor-default disabled:text-ink-muted"
    >
      {pending ? "กำลังบันทึก…" : "อ่านทั้งหมดแล้ว"}
    </button>
  );
}

const PREFS = [
  { key: "mine", label: "มีค่าใช้จ่ายที่ฉันต้องจ่ายด้วย", on: true },
  { key: "pay", label: "มีคนโอนเงินหรือแจ้งโอนถึงฉัน", on: true },
  { key: "plan", label: "แผนหรือสถานที่เปลี่ยน", on: false },
  { key: "member", label: "มีคนเข้าร่วมหรือขอเข้าร่วม", on: true },
  { key: "remind", label: "เตือนก่อนวันเดินทาง 1 วัน", on: true },
] as const;

/**
 * "แจ้งเตือนฉันเมื่อ" sheet. There is no push-notification backend or
 * preference model yet, so the switches only live in this page's state.
 */
export function NotificationSettingsButton() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => Object.fromEntries(PREFS.map((p) => [p.key, p.on])));
  return (
    <>
      <button
        type="button"
        aria-label="ตั้งค่าการแจ้งเตือน"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-icon border border-line bg-surface text-ink hover:bg-bg"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="แจ้งเตือนฉันเมื่อ"
        footer={
          <Button variant="ink" block onClick={() => setOpen(false)} className="mt-1">
            เสร็จ
          </Button>
        }
      >
        <p className="m-0 -mt-2 text-xs text-ink-muted">ทุกรายการยังดูได้ในหน้านี้ ตั้งค่านี้มีผลแค่การแจ้งเตือนบนมือถือ</p>
        <div className="flex flex-col">
          {PREFS.map((p) => {
            const on = prefs[p.key];
            return (
              <button
                key={p.key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setPrefs({ ...prefs, [p.key]: !on })}
                className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 border-0 border-b border-line-soft bg-transparent p-0 text-left text-[15px] font-medium text-ink"
              >
                {p.label}
                <span aria-hidden="true" className={cn("flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors duration-200", on ? "justify-end bg-primary" : "justify-start bg-control")}>
                  <span className="size-5 rounded-full bg-surface shadow-seg" />
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
