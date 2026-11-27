import type { Metadata } from "next";
import { PrintPlan } from "@/components/plan/PrintPlan";
import { PrintToolbar } from "@/components/plan/PrintToolbar";
import { getDocuments, getPlaces, getPlanItems, requireTripMember } from "@/lib/api";
import { formatDate, todayISO } from "@/lib/date";
import { buildPrintPlan } from "@/lib/plan-print";

// The default PDF file name comes from the document title.
export async function generateMetadata({ params }: PageProps<"/trips/[tripId]/plan/print">): Promise<Metadata> {
  const { tripId } = await params;
  const { trip } = await requireTripMember(tripId);
  return { title: `${trip.name} – แผนการเดินทาง` };
}

export default async function PrintPlanPage({ params }: PageProps<"/trips/[tripId]/plan/print">) {
  const { tripId } = await params;
  const { trip } = await requireTripMember(tripId);
  const [plan, places, documents] = await Promise.all([getPlanItems(tripId), getPlaces(tripId), getDocuments(tripId)]);

  return (
    <div className="flex flex-1 flex-col">
      <style>{"@page { size: A4 portrait; margin: 14mm; }"}</style>
      <PrintToolbar backHref={`/trips/${encodeURIComponent(tripId)}/plan`} />
      <main className="flex-1 bg-surface">
        <PrintPlan trip={trip} days={buildPrintPlan(trip, places, plan, documents)} printedOn={formatDate(todayISO())} />
      </main>
    </div>
  );
}
