"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { joinTokenFromInput } from "@/lib/next-path";

/**
 * "มีลิงก์เชิญ? เข้าร่วมทริปของเพื่อน": paste the invite link, then open
 * JoinTrip. The mockup links straight to JoinTrip; the paste sheet is self-designed.
 */
export function JoinLinkButton() {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const go = () => {
    const token = joinTokenFromInput(value);
    if (!token) {
      setError("ไม่ใช่ลิงก์เชิญ ลองคัดลอกลิงก์จากเพื่อนอีกครั้ง");
      return;
    }
    setOpen(false);
    router.push(`/join/${encodeURIComponent(token)}`);
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={buttonClasses({ variant: "dashed", block: true, className: "rounded-2xl text-sm" })}
      >
        <Icon name="link" size={18} />
        มีลิงก์เชิญ? เข้าร่วมทริปของเพื่อน
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="เข้าร่วมทริปด้วยลิงก์เชิญ"
        footer={
          <div className="flex flex-col gap-2">
            <Button size="lg" block onClick={go} disabled={!value.trim()}>
              เปิดลิงก์เชิญ
            </Button>
            <Button variant="soft" block onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <label htmlFor={inputId} className="text-sm font-semibold">
            ลิงก์เชิญจากเพื่อน
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            data-autofocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            placeholder="วางลิงก์ที่ได้รับ"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="h-12 rounded-icon border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted"
          />
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="m-0 text-[13px] font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </BottomSheet>
    </>
  );
}
