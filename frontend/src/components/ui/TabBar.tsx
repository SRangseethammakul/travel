"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { LinkPending } from "./LinkPending";

const tabs: { segment: string; label: string; icon: IconName }[] = [
  { segment: "", label: "ทริป", icon: "trip" },
  { segment: "plan", label: "แผน", icon: "plan" },
  { segment: "places", label: "สถานที่", icon: "place" },
  { segment: "expenses", label: "ค่าใช้จ่าย", icon: "receipt" },
  { segment: "summary", label: "สรุป", icon: "summary" },
];

/** Bottom navigation of a trip: ทริป · แผน · สถานที่ · ค่าใช้จ่าย · สรุป. */
export function TabBar({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/trips/${encodeURIComponent(tripId)}`;

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-app grid-cols-5 border-t border-line bg-surface px-1 pt-1.5 pb-[max(22px,env(safe-area-inset-bottom))]"
    >
      {tabs.map((t) => {
        const href = t.segment ? `${base}/${t.segment}` : base;
        const active = t.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[52px] flex-col items-center has-[[data-link-pending]]:opacity-60 justify-center gap-[3px] rounded-chip text-xs no-underline transition-colors duration-150",
              active ? "font-semibold text-primary hover:text-primary" : "font-medium text-ink-muted hover:text-ink",
            )}
          >
            <Icon name={t.icon} />
            {t.label}
            <LinkPending className="absolute top-1 right-3" />
          </Link>
        );
      })}
    </nav>
  );
}
