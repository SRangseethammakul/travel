import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid flex-1 grid-cols-[1fr_400px]">
      <span className="sr-only">กำลังโหลด…</span>
      <div className="flex flex-col gap-4 py-6 pr-6 pl-8">
        <Skeleton className="h-9 w-72 rounded-full" />
        <div className="overflow-hidden rounded-tile bg-surface">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-none border-b border-surface" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5 border-l border-line bg-surface p-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
