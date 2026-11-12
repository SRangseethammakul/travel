"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resetInviteAction, setInviteApproval, setInviteExpiry } from "@/lib/api/member-actions";
import type { ID, InviteExpiry } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const EXPIRY: { value: InviteExpiry; label: string }[] = [
  { value: "1d", label: "1 วัน" },
  { value: "7d", label: "7 วัน" },
  { value: "never", label: "ไม่หมดอายุ" },
];

interface InviteSettingsProps {
  tripId: ID;
  /** Full invite URL, or null when the trip has no invite yet. */
  url: string | null;
  expiry: InviteExpiry;
  /** "หมดอายุ 19 พ.ย. 2569 14:00" / "หมดอายุแล้ว" / null. */
  expiryNote: string | null;
  expired: boolean;
  requireApproval: boolean;
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
      {children}
    </p>
  );
}

/** Owner-only "ลิงก์เชิญ" card: copy, expiry, approval, reset. */
export function InviteSettings({ tripId, url, expiry, expiryNote, expired, requireApproval }: InviteSettingsProps) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error: string } | null>, after?: () => void) =>
    startTransition(async () => {
      setError("");
      const result = await fn();
      if (result?.error) setError(result.error);
      after?.();
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  };

  return (
    <section aria-labelledby="invite-h" className="flex flex-col gap-3 rounded-tile bg-surface p-3.5">
      <h2 id="invite-h" className="m-0 text-sm font-semibold">
        ลิงก์เชิญ
      </h2>

      {url ? (
        <div className="flex items-center gap-2.5 rounded-chip bg-bg py-1 pr-1 pl-3">
          <span className={cn("min-w-0 flex-1 truncate text-sm", expired ? "text-ink-muted line-through" : "text-ink-subtle")}>{url}</span>
          <button
            type="button"
            onClick={copy}
            disabled={expired}
            className="min-h-11 shrink-0 cursor-pointer rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-live="polite">{copied === "copied" ? "คัดลอกแล้ว" : copied === "failed" ? "คัดลอกไม่ได้" : "คัดลอก"}</span>
          </button>
        </div>
      ) : (
        <Button onClick={() => run(() => setInviteExpiry(tripId, "7d"))} disabled={pending} block>
          สร้างลิงก์เชิญ
        </Button>
      )}
      {expiryNote ? <span className={cn("-mt-1 text-xs", expired ? "font-semibold text-danger" : "text-ink-muted")}>{expiryNote}</span> : null}

      {url ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span id="expiry-label" className="text-[13px] font-semibold">
              หมดอายุใน
            </span>
            <div role="radiogroup" aria-labelledby="expiry-label" className="grid grid-cols-3 gap-1.5">
              {EXPIRY.map((e) => {
                const on = !expired && e.value === expiry;
                return (
                  <button
                    key={e.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => run(() => setInviteExpiry(tripId, e.value))}
                    className={cn(
                      "relative min-h-10 cursor-pointer rounded-[10px] border-[1.5px] text-[13px] font-semibold transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[''] disabled:cursor-wait",
                      on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink hover:border-ink-muted",
                    )}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={requireApproval}
            disabled={pending}
            onClick={() => run(() => setInviteApproval(tripId, !requireApproval))}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-ink disabled:cursor-wait"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold">ต้องอนุมัติก่อนเข้าทริป</span>
              <span className="text-xs text-ink-muted">กันคนนอกที่ได้ลิงก์ต่อๆ กันมา</span>
            </span>
            <span aria-hidden="true" className={cn("flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors duration-200", requireApproval ? "justify-end bg-primary" : "justify-start bg-control")}>
              <span className="size-5 rounded-full bg-surface shadow-seg" />
            </span>
          </button>
        </>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {url ? (
        <Button variant="danger-outline" size="sm" block onClick={() => setConfirmReset(true)} disabled={pending}>
          รีเซ็ตลิงก์ (ลิงก์เดิมจะใช้ไม่ได้)
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        title="รีเซ็ตลิงก์เชิญ?"
        description="ลิงก์เดิมที่ส่งไปแล้วจะใช้เข้าทริปไม่ได้อีก ต้องส่งลิงก์ใหม่ให้คนที่ยังไม่ได้เข้าร่วม"
        confirmLabel="รีเซ็ตลิงก์"
        pending={pending}
        onConfirm={() => run(() => resetInviteAction(tripId, expiry), () => setConfirmReset(false))}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}
