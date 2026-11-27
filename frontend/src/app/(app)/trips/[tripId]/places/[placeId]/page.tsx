import { notFound } from "next/navigation";
import { PlaceDetail } from "@/components/places/PlaceDetail";
import { BackHeader } from "@/components/ui/BackHeader";
import { getTripTags, getPlanItems, requireTripMember } from "@/lib/api";
import { getExpense } from "@/lib/api/queries";
import { getPlace } from "@/lib/api/plan-queries";
import { canEditExpense, canEditPlanEntry } from "@/lib/permissions";
import { placeVisits } from "@/lib/plan";

/** Place detail: a read-only view for every member; the owner / the editor who added it get an "แก้ไข" button to the edit page. */
export default async function PlaceDetailPage({ params }: PageProps<"/trips/[tripId]/places/[placeId]">) {
  const { tripId, placeId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const place = await getPlace(tripId, placeId);
  if (!place) notFound();
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const [tripTags, plan] = await Promise.all([getTripTags(tripId), getPlanItems(tripId)]);
  const tagNames = new Map(tripTags.map((t) => [t.id, t.name]));
  const visits = placeVisits(plan, trip).get(place.id) ?? [];
  // The Expense this hotel's price is recorded in (null when none, or it was deleted meanwhile).
  const expense = place.stay?.expenseId ? await getExpense(tripId, place.stay.expenseId) : null;
  const linkedExpense = expense ? { id: expense.id, title: expense.title, amount: expense.amount, splitMode: expense.splitMode, canEdit: canEditExpense(me, expense) } : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bg">
      <BackHeader title={place.name} href={`${base}/places`} />
      <PlaceDetail
        tripId={tripId}
        place={place}
        me={me}
        startDate={trip.startDate}
        visits={visits}
        linkedExpense={linkedExpense}
        tagNames={place.tagIds.flatMap((id) => tagNames.get(id) ?? [])}
        {...(canEditPlanEntry(me, place) ? { editHref: `${base}/places/${encodeURIComponent(placeId)}/edit` } : {})}
      />
    </div>
  );
}
