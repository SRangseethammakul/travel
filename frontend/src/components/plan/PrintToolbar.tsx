"use client";

import { useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const subscribe = () => () => {};
// LINE's in-app browser cannot open the print dialog (ADR 0003).
const inLine = () => navigator.userAgent.includes(" Line/");

/** Screen-only bar of the print page: back link and "save as PDF" (window.print()). Never printed. */
export function PrintToolbar({ backHref }: { backHref: string }) {
  const lineBrowser = useSyncExternalStore(subscribe, inLine, () => false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3 print:hidden">
      <ButtonLink href={backHref} variant="secondary" size="sm" icon={<Icon name="back" size={16} />}>
        กลับ
      </ButtonLink>
      {lineBrowser ? (
        <p role="status" className="m-0 min-w-0 flex-1 text-sm font-semibold text-todo">
          เปิดใน Safari/Chrome เพื่อบันทึก PDF
        </p>
      ) : (
        <Button size="sm" className="ml-auto" icon={<Icon name="print" size={16} />} onClick={() => window.print()}>
          บันทึกเป็น PDF
        </Button>
      )}
      {lineBrowser ? null : (
        <p className="m-0 basis-full text-[13px] text-ink-muted">
          กดแล้วเลือก “บันทึกเป็น PDF” — ไฟล์จะอยู่ในแอป Files หรือโฟลเดอร์ดาวน์โหลด
        </p>
      )}
    </div>
  );
}
