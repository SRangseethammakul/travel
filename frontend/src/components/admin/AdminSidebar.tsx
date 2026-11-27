import Link from "next/link";
import type { User } from "@/lib/api/types";
import { Avatar } from "@/components/ui/Avatar";
import { AdminNav } from "./AdminNav";

export function AdminSidebar({ admin }: { admin: User }) {
  return (
    <aside className="sticky top-0 flex h-dvh flex-col gap-1 border-r border-line bg-surface px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-[10px] bg-primary font-display text-[15px] font-bold text-surface">
          P
        </span>
        <span className="flex flex-col">
          <span className="font-display text-base font-semibold">Plan Trip</span>
          <span className="text-xs text-ink-muted">ผู้ดูแลระบบ</span>
        </span>
      </div>
      <AdminNav />
      <div className="flex-1" />
      <Link href="/trips" className="flex min-h-11 items-center px-3 text-sm text-ink-subtle no-underline hover:text-ink">
        ← กลับไปที่แอป
      </Link>
      <div className="flex items-center gap-2.5 border-t border-line-soft px-2 pt-3">
        <Avatar name={admin.name} color={admin.color} src={admin.avatarUrl} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-semibold">{admin.name}</span>
          <span className="truncate text-xs text-ink-muted">{admin.email}</span>
        </span>
      </div>
    </aside>
  );
}
