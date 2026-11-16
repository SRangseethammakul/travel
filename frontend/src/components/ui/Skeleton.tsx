import { cn } from "@/lib/cn";

/** Grey placeholder block shown while a route loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-tile bg-line-soft", className)} />;
}

/** Whole-page loading placeholder: title area + a few cards. Announced once to screen readers. */
export function PageSkeleton({ header = true, cards = 3 }: { header?: boolean; cards?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-1 flex-col gap-4 px-5 pt-5 pb-6">
      <span className="sr-only">กำลังโหลด…</span>
      {header ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded-chip" />
          <Skeleton className="h-7 w-48 rounded-chip" />
        </div>
      ) : null}
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
