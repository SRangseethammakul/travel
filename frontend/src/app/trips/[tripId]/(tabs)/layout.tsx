import { TabBar } from "@/components/ui/TabBar";
import { requireTripMember } from "@/lib/api";

/**
 * Shell of the 5 trip tabs (ทริป · แผน · สถานที่ · ค่าใช้จ่าย · สรุป).
 * Checks membership once for every tab; pages render their own headers.
 * Bottom padding keeps content clear of the fixed TabBar (and the Fab above it).
 */
export default async function TripTabsLayout({ children, params }: LayoutProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  await requireTripMember(tripId);
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</div>
      <TabBar tripId={tripId} />
    </>
  );
}
