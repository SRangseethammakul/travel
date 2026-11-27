"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { forceSignOut } from "@/lib/api/admin-actions";

/** "บังคับออกจากระบบทุกเครื่อง" + confirmation (the Server Action redirects back with the success banner). */
export function ForceSignOut({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      {error ? (
        <span role="alert" className="text-sm text-danger-ink">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="min-h-11 cursor-pointer rounded-chip border border-danger-line bg-surface px-[18px] text-sm font-semibold text-danger-ink hover:bg-danger-soft"
      >
        บังคับออกจากระบบทุกเครื่อง
      </button>
      <ConfirmDialog
        open={open}
        title={`ออกจากระบบ ${name} ทุกเครื่อง?`}
        description={`ทุก session ของ ${name} จะหมดอายุทันที ข้อมูลทริปไม่หาย ${name} เข้าสู่ระบบใหม่ได้ตามปกติ`}
        confirmLabel="ออกจากระบบทุกเครื่อง"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await forceSignOut(userId);
            if (res?.error) {
              setError(res.error);
              setOpen(false);
            }
          })
        }
      />
    </>
  );
}
