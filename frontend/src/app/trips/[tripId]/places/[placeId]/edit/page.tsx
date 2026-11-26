import { notFound, redirect } from "next/navigation";
import { PlaceForm } from "@/components/places/PlaceForm";
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

/** Edit a place or hotel: owner / the editor who added it. Everyone else is sent back to the read-only page. */
export default async function EditPlacePage({ params, searchParams }: PageProps<"/trips/[tripId]/places/[placeId]/edit">) {
  const { tripId, placeId } = await params;
  // Set by AddPlace when some of the photos picked there did not upload.
  const failedParam = Number((await searchParams).photoFailed);
  const photoFailed = Number.isInteger(failedParam) && failedParam > 0 ? failedParam : 0;
  const { trip, me } = await requireTripMember(tripId);
  const place = await getPlace(tripId, placeId);
  if (!place) notFound();
  const detail = `/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(placeId)}`;
  if (!canEditPlanEntry(me, place)) redirect(detail);
  const [places, tripTags, userId, plan, myTags, members] = await Promise.all([getPlaces(tripId), getTripTags(tripId), getCurrentUserId(), getPlanItems(tripId), getUserTags(), getMembers(tripId)]);
  const visits = placeVisits(plan, trip).get(place.id) ?? [];
  // The Expense this hotel's price is recorded in (null when none, or it was deleted meanwhile).
  const expense = place.stay?.expenseId ? await getExpense(tripId, place.stay.expenseId) : null;
  const linkedExpense = expense ? { id: expense.id, title: expense.title, amount: expense.amount, splitMode: expense.splitMode, canEdit: canEditExpense(me, expense) } : null;
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
      <BackHeader title={place.type === "stay" ? "แก้ไขที่พัก" : "แก้ไขสถานที่"} subtitle={place.name} href={detail} kind="close" />
      <PlacePlanInfo tripId={tripId} place={place} startDate={trip.startDate} visits={visits} className="mx-5 mt-1 rounded-tile border border-line bg-bg/60 px-3.5" />
      {photoFailed ? (
        <p role="alert" className="mx-5 mt-3 mb-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
          บันทึกสถานที่แล้ว แต่อัปโหลดรูปไม่สำเร็จ {photoFailed} รูป ลองเพิ่มรูปอีกครั้งด้านล่าง
        </p>
      ) : null}
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
        memberCount={members.filter((m) => !m.status || m.status === "active").length}
        linkedExpense={linkedExpense}
        tripDates={{ start: trip.startDate, end: trip.endDate }}
        myTags={myTags.map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
        tripTags={tripTags.filter((t) => t.ownerId !== userId).map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
      />
    </div>
  );
}
