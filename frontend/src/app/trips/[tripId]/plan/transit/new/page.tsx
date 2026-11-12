import { redirect } from "next/navigation";
import { AddToPlanHeader } from "@/components/plan/AddToPlanHeader";
import { TransitForm } from "@/components/plan/TransitForm";
import { getDocuments, getPlaces, requireTripMember } from "@/lib/api";
import { todayISO, tripDayDate } from "@/lib/date";
import { canAddExpense, canEditPlan } from "@/lib/permissions";
import { resolveDay } from "@/lib/plan";

export default async function AddTransitPage({ params, searchParams }: PageProps<"/trips/[tripId]/plan/transit/new">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const day = resolveDay(sp.day, trip, todayISO());
  if (!canEditPlan(me)) redirect(`${base}/plan?day=${day}`);
  const [documents, places] = await Promise.all([getDocuments(tripId), getPlaces(tripId)]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <AddToPlanHeader title="เพิ่มการเดินทาง" closeHref={`${base}/plan?day=${day}`} planBase={`${base}/plan`} day={day} current="transit" />
      <TransitForm
        tripId={tripId}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        defaultDate={tripDayDate(trip.startDate, day)}
        documents={documents.map((d) => ({ id: d.id, name: d.name, mime: d.mime }))}
        placeOptions={places.filter((p) => p.type === "transit" || p.type === "stay").map((p) => ({ id: p.id, name: p.name }))}
        canAddExpense={canAddExpense(me)}
      />
    </div>
  );
}
