import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5 px-8 py-6">
      <span className="sr-only">กำลังโหลด…</span>
      <Skeleton className="h-12" />
      <div className="grid grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
