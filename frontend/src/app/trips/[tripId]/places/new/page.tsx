import { redirect } from "next/navigation";
import { PlaceForm } from "@/components/places/PlaceForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { getCurrentUserId, getPlaces, getTripTags, getUserTags, requireTripMember } from "@/lib/api";
import { canEditPlan } from "@/lib/permissions";
import { areasInCity, legHint } from "@/lib/place-form";
import { citySlug, tripCities } from "@/lib/places";

export default async function AddPlacePage({ params, searchParams }: PageProps<"/trips/[tripId]/places/new">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const back = `/trips/${encodeURIComponent(tripId)}/places`;
  if (!canEditPlan(me)) redirect(back);

  const userId = await getCurrentUserId();
  const [places, myTags, tripTags] = await Promise.all([getPlaces(tripId), getUserTags(), getTripTags(tripId)]);
  const cities = tripCities(places, trip.legs);
  const wanted = typeof sp.city === "string" ? sp.city : undefined;
  const defaultCity = cities.find((c) => citySlug(c) === wanted) ?? cities[0] ?? "";
  const areasByCity = Object.fromEntries(cities.map((c) => [c, areasInCity(places, c).flatMap((a) => (a.area ? [a.area] : []))]));
  const legHints = Object.fromEntries(cities.flatMap((c) => {
    const hint = legHint(trip.legs, c);
    return hint ? [[c, hint]] : [];
  }));

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="เพิ่มสถานที่" href={back} kind="close" />
      <PlaceForm
        tripId={tripId}
        userId={userId}
        cities={cities}
        areasByCity={areasByCity}
        legHints={legHints}
        defaultCity={defaultCity}
        myTags={myTags.map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
        tripTags={tripTags.filter((t) => t.ownerId !== userId).map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
      />
    </div>
  );
}
