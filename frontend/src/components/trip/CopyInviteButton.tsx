"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { buttonClasses } from "@/components/ui/Button";

/** "คัดลอกลิงก์เชิญเข้าทริป": copies /join/<token> and confirms in place. */
export function CopyInviteButton({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses({ variant: "dashed", size: "sm", block: true, className: "text-sm" })}>
      <Icon name={state === "copied" ? "check" : "link"} size={18} />
      <span aria-live="polite">
        {state === "copied" ? "คัดลอกลิงก์แล้ว" : state === "failed" ? "คัดลอกไม่ได้ ลองอีกครั้ง" : "คัดลอกลิงก์เชิญเข้าทริป"}
      </span>
    </button>
  );
}
