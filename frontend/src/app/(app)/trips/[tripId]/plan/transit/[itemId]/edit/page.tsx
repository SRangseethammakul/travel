import { notFound, redirect } from "next/navigation";
import { TransitForm } from "@/components/plan/TransitForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { getDocuments, getPlaces, getPlanItems, requireTripMember } from "@/lib/api";
import { canEditPlanEntry } from "@/lib/permissions";
import { itemDay } from "@/lib/plan";
import { transitDraftFromItem } from "@/lib/plan-form";

export default async function EditTransitPage({ params }: PageProps<"/trips/[tripId]/plan/transit/[itemId]/edit">) {
  const { tripId, itemId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [plan, documents, places] = await Promise.all([getPlanItems(tripId), getDocuments(tripId), getPlaces(tripId)]);
  const item = plan.find((i) => i.id === itemId);
  if (!item || item.kind !== "transit") notFound();
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const back = `${base}/plan?day=${Math.max(1, itemDay(item, trip))}`;
  // Owner, or the editor who added it (the backend decides; this only sends others back to the plan).
  if (!canEditPlanEntry(me, item)) redirect(back);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="แก้ไขการเดินทาง" href={back} kind="close" />
      <TransitForm
        tripId={tripId}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        defaultDate={item.departAt.slice(0, 10)}
        documents={documents.map((d) => ({ id: d.id, name: d.name, mime: d.mime }))}
        placeOptions={places.filter((p) => p.type === "transit" || p.type === "stay").map((p) => ({ id: p.id, name: p.name }))}
        canAddExpense={false}
        edit={{ itemId: item.id, draft: transitDraftFromItem(item), ...(item.expenseId ? { expenseHref: `${base}/expenses/${encodeURIComponent(item.expenseId)}` } : {}) }}
      />
    </div>
  );
}
