"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/users", label: "ผู้ใช้" },
  { href: "/admin/trips", label: "ทริป" },
  { href: "/admin/system", label: "ระบบ" },
];

/** Sidebar menu. Client only to read the pathname for aria-current. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูผู้ดูแล" className="flex flex-col gap-1">
      {items.map((item) => {
        const current = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-chip px-3 text-sm font-semibold no-underline",
              current ? "bg-primary-soft text-primary-ink hover:text-primary-ink" : "text-ink-subtle hover:bg-bg hover:text-ink-subtle",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
