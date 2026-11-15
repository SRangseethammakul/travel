"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { joinTrip } from "@/lib/api/join-actions";
import type { ColorKey } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export interface JoinOption {
  id: string;
  name: string;
  color: ColorKey;
  /** "เข้าร่วมแล้ว · ผู้จัดทริป" / "ยังไม่มีเจ้าของ · 4 รายการ ส่วนที่ต้องจ่าย ฿6,850". */
  sub: string;
  taken: boolean;
}

interface JoinTripFormProps {
  token: string;
  options: JoinOption[];
  /** Member id, "new", or null. */
  initialPick: string | null;
  initialName: string;
  signedIn: boolean;
}

function Radio({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-disabled")}>
      <span className={cn("size-2.5 rounded-full", on ? "bg-primary" : "bg-transparent")} />
    </span>
  );
}

/**
 * "คุณคือใครในทริปนี้?": Claim an Unclaimed Member or join as a new one (B10).
 * Signed-out visitors go to Login and come back here with the choice kept.
 */
export function JoinTripForm({ token, options, initialPick, initialName, signedIn }: JoinTripFormProps) {
  const router = useRouter();
  const nameId = useId();
  const legendId = useId();
  const [pick, setPick] = useState<string | null>(initialPick);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const chosen = options.find((o) => o.id === pick && !o.taken);
  const isNew = pick === "new";

  const join = () => {
    setNote("");
    const newName = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!chosen && !isNew) {
      setError("เลือกชื่อของคุณก่อน");
      return;
    }
    if (isNew && !newName) {
      setError("ใส่ชื่อที่ให้เพื่อนเห็น");
      return;
    }
    setError("");
    if (!signedIn) {
      const query = chosen ? `as=${encodeURIComponent(chosen.id)}` : `as=new&name=${encodeURIComponent(newName)}`;
      router.push(`/login?next=${encodeURIComponent(`/join/${encodeURIComponent(token)}?${query}`)}`);
      return;
    }
    startTransition(async () => {
      const result = await joinTrip(token, chosen ? { claimMemberId: chosen.id } : { displayName: newName });
      if ("error" in result) setError(result.error);
      else setNote("ส่งคำขอเข้าร่วมแล้ว รอผู้จัดทริปอนุมัติ เมื่ออนุมัติแล้วทริปจะขึ้นในหน้าทริปของฉัน");
    });
  };

  return (
    <>
      <fieldset hidden={Boolean(note)} className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend id={legendId} className="mb-1 flex flex-col gap-1 p-0">
          <span className="font-display text-lg font-semibold">คุณคือใครในทริปนี้?</span>
          <span className="text-[13px] leading-normal text-ink-muted">เลือกชื่อที่เพื่อนเพิ่มไว้ ค่าใช้จ่ายที่บันทึกในชื่อนั้นจะย้ายมาอยู่ในบัญชีคุณ</span>
        </legend>
        <div role="radiogroup" aria-labelledby={legendId} className="flex flex-col gap-2">
          {options.map((o) => {
            const on = pick === o.id && !o.taken;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={o.taken || undefined}
                onClick={() => !o.taken && setPick(o.id)}
                className={cn(
                  "flex min-h-[60px] items-center gap-3 rounded-2xl border-[1.5px] px-3.5 text-left text-ink transition-colors duration-150",
                  on ? "border-primary bg-primary-soft" : "border-line bg-surface",
                  o.taken ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-ink-muted",
                )}
              >
                <Radio on={on} />
                <Avatar name={o.name} color={o.color} size="md" />
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{o.name}</span>
                  <span className="text-xs text-ink-muted">{o.sub}</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={isNew}
            onClick={() => setPick("new")}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-dashed px-3.5 text-left text-ink transition-colors duration-150",
              isNew ? "border-primary bg-primary-soft" : "border-control bg-surface hover:border-ink-muted",
            )}
          >
            <Radio on={isNew} />
            <span className="font-medium">ไม่มีชื่อฉัน เพิ่มเป็นสมาชิกใหม่</span>
          </button>
        </div>
        {isNew ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-semibold">
              ชื่อที่ให้เพื่อนเห็น
            </label>
            <input
              id={nameId}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น Ploy"
              className="h-12 rounded-icon border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted"
            />
          </div>
        ) : null}
      </fieldset>

      <footer className="sticky bottom-0 z-10 -mx-5 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <p role="status" className={note ? "m-0 rounded-chip bg-todo-soft px-3 py-2 text-[13px] font-semibold text-todo" : "sr-only"}>
          {note}
        </p>
        {note ? null : (
          <Button size="lg" block onClick={join} disabled={pending} aria-busy={pending || undefined} className="h-[54px] rounded-2xl">
            {pending ? "กำลังเข้าร่วม…" : chosen ? `เข้าร่วมในชื่อ ${chosen.name}` : "เข้าร่วมทริป"}
          </Button>
        )}
        {!signedIn ? <span className="text-center text-xs text-ink-muted">จะให้เข้าสู่ระบบด้วย LINE หรือ Google ก่อน</span> : null}
        <Link href="/trips" className={buttonClasses({ variant: "soft", size: "sm", block: true, className: "bg-transparent text-primary hover:text-primary-hover" })}>
          {note ? "ไปที่ทริปของฉัน" : "ไว้ก่อน"}
        </Link>
      </footer>
    </>
  );
}
