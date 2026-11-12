import type { ReactNode } from "react";
import { ScrollStrip } from "@/components/ui/ScrollStrip";

/** Day cards/tabs: a 4-column grid (mockup) for trips up to 4 days, a scrolling row for longer ones. */
export function DayStrip({ long, children }: { long: boolean; children: ReactNode }) {
  if (!long) return <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0">{children}</ol>;
  return (
    <ScrollStrip>
      <ol className="m-0 flex list-none gap-2 p-0">{children}</ol>
    </ScrollStrip>
  );
}
