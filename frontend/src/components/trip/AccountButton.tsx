"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/api/auth-actions";
import type { User } from "@/lib/api/types";

/** Round "A" button on Trips: shows the signed-in account and sign-out (self-designed sheet). */
export function AccountButton({ user }: { user: Pick<User, "name" | "email" | "provider" | "color" | "avatarUrl"> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="บัญชีของฉัน"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-opacity hover:opacity-90"
      >
        <Avatar name={user.name} color={user.color} src={user.avatarUrl} size="xl" />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="บัญชีของฉัน"
        footer={
          <div className="flex flex-col gap-2">
            <form action={signOut}>
              <Button type="submit" variant="danger-outline" block>
                ออกจากระบบ
              </Button>
            </form>
            <Button variant="soft" block onClick={() => setOpen(false)}>
              ปิด
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <Avatar name={user.name} color={user.color} src={user.avatarUrl} size="xl" />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{user.name}</span>
            <span className="truncate text-[13px] text-ink-muted">
              {user.email} · เข้าสู่ระบบด้วย {user.provider === "line" ? "LINE" : "Google"}
            </span>
          </span>
        </div>
      </BottomSheet>
    </>
  );
}
