import Link from "next/link";
import type { AdminTripStatus, AuthProvider } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { providerLabel, tripStatusLabel } from "@/utils/admin";

/** Filter chip as a link (state lives in the URL). */
export function FilterPill({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold no-underline",
        on ? "border-ink bg-ink text-surface hover:text-surface" : "border-line-strong bg-surface text-ink hover:bg-bg hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export function ProviderBadge({ provider }: { provider: AuthProvider }) {
  return <span className="rounded-full bg-line-soft px-2 py-0.5 text-xs font-semibold text-ink-subtle">{providerLabel[provider]}</span>;
}

const statusStyle: Record<AdminTripStatus, string> = {
  upcoming: "bg-interest-soft text-interest-ink",
  ongoing: "bg-primary-soft text-primary-ink",
  past: "bg-line-soft text-ink-subtle",
};

export function TripStatusBadge({ status }: { status: AdminTripStatus }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", statusStyle[status])}>{tripStatusLabel[status]}</span>;
}
