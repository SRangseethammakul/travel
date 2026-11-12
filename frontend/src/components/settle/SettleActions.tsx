"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { SlipPicker } from "@/components/expenses/SlipPicker";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { confirmTransfer, markTransferSent, replaceTransferSlip } from "@/lib/api/settlement-actions";
import type { ID } from "@/lib/api/types";
import { MAX_SLIP_BYTES } from "@/lib/expense-draft";

function slipForm(file: File): FormData {
  const form = new FormData();
  form.append("slip", file);
  return form;
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
      {children}
    </p>
  );
}

/**
 * Payer, pending: QR card (server-rendered `children`) + attach slip, and the
 * fixed "แจ้งว่าโอนแล้ว" button. Rendered as the page body + footer.
 */
export function PayerPendingView({ tripId, toId, top, children }: { tripId: ID; toId: ID; top: ReactNode; children: ReactNode }) {
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError("");
      const result = await markTransferSent(tripId, toId, slip && slipForm(slip));
      if (result?.error) setError(result.error);
    });

  return (
    <>
      <main className="flex flex-1 flex-col gap-3.5 px-5 pt-2 pb-6">
        {top}
        <section aria-label="ช่องทางโอน" className="flex flex-col items-center gap-3 rounded-[22px] bg-surface px-4 py-[18px]">
          {children}
          <SlipPicker label="แนบสลิปการโอน" value={slip} onPick={setSlip} onRemove={() => setSlip(null)} />
        </section>
      </main>
      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button size="lg" block onClick={send} disabled={pending} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? "กำลังแจ้ง…" : "แจ้งว่าโอนแล้ว"}
        </Button>
      </footer>
    </>
  );
}

/** Receiver, sent: "ยืนยันว่าได้รับ ฿x แล้ว" (ink button, as in the mockup). */
export function ConfirmReceivedButton({ tripId, settlementId, label }: { tripId: ID; settlementId: ID; label: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button
        block
        disabled={pending}
        aria-busy={pending || undefined}
        variant="ink"
        onClick={() =>
          startTransition(async () => {
            setError("");
            const result = await confirmTransfer(tripId, settlementId);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "กำลังยืนยัน…" : label}
      </Button>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

/**
 * Payer, sent: attach or replace the slip (B34) while the receiver has not
 * confirmed yet. Picking a file uploads it straight away.
 */
export function ReplaceSlipButton({ tripId, settlementId, hasSlip }: { tripId: ID; settlementId: ID; hasSlip: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SLIP_BYTES || !/^(image\/|application\/pdf$)/.test(file.type)) {
      setError("แนบได้เฉพาะรูปหรือ PDF ขนาดไม่เกิน 10 MB");
      return;
    }
    startTransition(async () => {
      setError("");
      setDone(false);
      const result = await replaceTransferSlip(tripId, settlementId, slipForm(file));
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variant={hasSlip ? "secondary" : "dashed"}
        size="sm"
        block
        disabled={pending}
        aria-busy={pending || undefined}
        icon={<Icon name="image" size={18} />}
        onClick={() => fileRef.current?.click()}
      >
        {pending ? "กำลังอัปโหลด…" : hasSlip ? "เปลี่ยนสลิป" : "แนบสลิปการโอน"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {done ? "บันทึกสลิปแล้ว" : ""}
      </span>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}
