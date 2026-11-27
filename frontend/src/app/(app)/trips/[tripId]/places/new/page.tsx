import { redirect } from "next/navigation";
import { PlaceForm } from "@/components/places/PlaceForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { getCurrentUserId, getMembers, getPlaces, getTripTags, getUserTags, requireTripMember } from "@/lib/api";
import { canAddExpense, canEditPlan } from "@/lib/permissions";
import { areasInCity, legHint, PLACE_TYPES } from "@/lib/place-form";
import { legCity } from "@/lib/plan";
import { citySlug, tripCities } from "@/lib/places";

export default async function AddPlacePage({ params, searchParams }: PageProps<"/trips/[tripId]/places/new">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const back = `/trips/${encodeURIComponent(tripId)}/places`;
  if (!canEditPlan(me)) redirect(back);

  const userId = await getCurrentUserId();
  const [places, myTags, tripTags, members] = await Promise.all([getPlaces(tripId), getUserTags(), getTripTags(tripId), getMembers(tripId)]);
  const dest0 = trip.destination.trim();
  const found = tripCities(places, trip.legs);
  // A trip with no places yet still offers its destination as the city.
  const cities = found.length || !dest0 ? found : [dest0];
  const wanted = typeof sp.city === "string" ? sp.city : undefined;
  // City: the one asked for (?city=) → the trip's destination → the only city → none (the user picks).
  const dest = cities.find((c) => c.toLowerCase() === trip.destination.trim().toLowerCase());
  const dayParam = Number(typeof sp.day === "string" ? sp.day : "");
  const fromDay = Number.isInteger(dayParam) && dayParam >= 1 ? dayParam : undefined;
  const typeParam = PLACE_TYPES.find((t) => t === sp.type);
  const dayCity = fromDay ? legCity(trip.legs, fromDay) : null;
  const defaultCity = cities.find((c) => citySlug(c) === wanted) ?? cities.find((c) => c === dayCity) ?? dest ?? (cities.length === 1 ? cities[0] : "");
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
        tripDates={{ start: trip.startDate, end: trip.endDate }}
        fromDay={fromDay}
        {...(typeParam ? { defaultType: typeParam } : {})}
        canAddExpense={canAddExpense(me)}
        memberCount={members.filter((m) => !m.status || m.status === "active").length}
        myTags={myTags.map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
        tripTags={tripTags.filter((t) => t.ownerId !== userId).map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }))}
      />
    </div>
  );
}
