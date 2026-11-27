import { Skeleton } from "@/components/ui/Skeleton";

/** Row skeletons from the AdminUsers "กำลังโหลด" mockup state. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4 px-8 py-6">
      <span className="sr-only">กำลังโหลด…</span>
      <Skeleton className="h-9 w-64 rounded-full" />
      <div className="overflow-hidden rounded-tile bg-surface">
        <Skeleton className="h-11 rounded-none" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} aria-hidden="true" className="grid h-14 grid-cols-[2.4fr_2.4fr_1fr_0.8fr_1.2fr_1.2fr] items-center gap-4 border-b border-line-soft px-5">
            <span className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </span>
            <Skeleton className="h-3 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-14 rounded-md" />
            <Skeleton className="h-3 w-6 justify-self-end rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
