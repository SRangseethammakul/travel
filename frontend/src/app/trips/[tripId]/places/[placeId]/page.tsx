import { notFound } from "next/navigation";
import { PlaceForm } from "@/components/places/PlaceForm";
import { PlaceDetail } from "@/components/places/PlaceDetail";
import { PlacePlanInfo } from "@/components/places/PlacePlanInfo";
import { PlacePhotos } from "@/components/places/PlacePhotos";
import { BackHeader } from "@/components/ui/BackHeader";
import { getCurrentUserId, getMembers, getPlaces, getPlanItems, getTripTags, getUserTags, requireTripMember } from "@/lib/api";
import { getExpense } from "@/lib/api/queries";
import { getPlace } from "@/lib/api/plan-queries";
import { canAddExpense, canEditExpense, canEditPlanEntry } from "@/lib/permissions";
import { areasInCity, legHint } from "@/lib/place-form";
import { placeVisits } from "@/lib/plan";
import { tripCities } from "@/lib/places";

/** Place detail: owner / the editor who added it get the edit form, everyone else a read-only view with the note. */
export default async function PlaceDetailPage({ params }: PageProps<"/trips/[tripId]/places/[placeId]">) {
  const { tripId, placeId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const place = await getPlace(tripId, placeId);
  if (!place) notFound();
  const back = `/trips/${encodeURIComponent(tripId)}/places`;
  const [places, tripTags, userId, plan] = await Promise.all([getPlaces(tripId), getTripTags(tripId), getCurrentUserId(), getPlanItems(tripId)]);
  const tagNames = new Map(tripTags.map((t) => [t.id, t.name]));
  const canEdit = canEditPlanEntry(me, place);
  const visits = placeVisits(plan, trip).get(place.id) ?? [];
  // The Expense this hotel's price is recorded in (null when none, or it was deleted meanwhile).
  const expense = place.stay?.expenseId ? await getExpense(tripId, place.stay.expenseId) : null;
  const linkedExpense = expense ? { id: expense.id, title: expense.title, amount: expense.amount, splitMode: expense.splitMode, canEdit: canEditExpense(me, expense) } : null;

  if (!canEdit) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col bg-bg">
        <BackHeader title={place.name} href={back} />
        <PlaceDetail tripId={tripId} place={place} me={me} startDate={trip.startDate} visits={visits} linkedExpense={linkedExpense} tagNames={place.tagIds.flatMap((id) => tagNames.get(id) ?? [])} />
      </div>
    );
  }

  const [myTags, members] = await Promise.all([getUserTags(), getMembers(tripId)]);
  const cities = tripCities(places, trip.legs);
  const areasByCity = Object.fromEntries(cities.map((c) => [c, areasInCity(places, c).flatMap((a) => (a.area ? [a.area] : []))]));
  const legHints = Object.fromEntries(
    cities.flatMap((c) => {
      const hint = legHint(trip.legs, c);
      return hint ? [[c, hint]] : [];
    }),
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="แก้ไขสถานที่" subtitle={place.name} href={back} kind="close" />
      <PlacePlanInfo tripId={tripId} place={place} startDate={trip.startDate} visits={visits} className="mx-5 mt-1 rounded-tile border border-line bg-bg/60 px-3.5" />
      <PlacePhotos tripId={tripId} placeId={place.id} placeName={place.name} photos={place.photos} me={me} className="mx-5 mt-3 rounded-tile border border-line bg-bg/60 p-3.5" />
      <PlaceForm
        key={placeId}
        tripId={tripId}
        userId={userId}
        cities={cities}
        areasByCity={areasByCity}
        legHints={legHints}
        defaultCity={place.city}
        initial={place}
        canAddExpense={canAddExpense(me)}
        memberCount={members.length}
        linkedExpense={linkedExpense}
        tripDates={{ start: trip.startDate, end: trip.endDate }}
        myTags={myTags.map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
        tripTags={tripTags.filter((t) => t.ownerId !== userId).map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
      />
    </div>
  );
}
