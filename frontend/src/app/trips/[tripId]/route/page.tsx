import { RouteEditor } from "@/components/plan/RouteEditor";
import { BackHeader } from "@/components/ui/BackHeader";
import { getPlaces, getPlanItems, requireTripMember } from "@/lib/api";
import { formatDateRange, formatDayMonth, tripDayDate } from "@/lib/date";
import { canEditTripStructure } from "@/lib/permissions";
import { itemDay, tripDayCount } from "@/lib/plan";
import { tripCities } from "@/lib/places";

export default async function TripRoutePage({ params }: PageProps<"/trips/[tripId]/route">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [places, items] = await Promise.all([getPlaces(tripId), getPlanItems(tripId)]);
  const legs = trip.legs ?? [];
  const dayCount = tripDayCount(trip);
  const byId = new Map(places.map((p) => [p.id, p]));

  const views = legs.map((l) => {
    const from = tripDayDate(trip.startDate, l.from);
    const to = tripDayDate(trip.startDate, l.to);
    // Stay = a "ที่พัก" Place planned inside the leg's days, else any ที่พัก in that city.
    const plannedStay = items.flatMap((i) => {
      const p = i.kind === "place" ? byId.get(i.placeId) : undefined;
      const d = itemDay(i, trip);
      return p && p.type === "stay" && p.city === l.city && d >= l.from && d <= l.to ? [p] : [];
    })[0];
    const stay = plannedStay ?? places.find((p) => p.type === "stay" && p.city === l.city);
    return {
      ...l,
      dates: l.from === l.to ? formatDayMonth(from) : formatDateRange(from, to).replace(/ \d{4}$/, ""),
      places: places.filter((p) => p.city === l.city).length,
      stay: stay?.name ?? null,
    };
  });

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader title="เส้นทางเมือง" subtitle={`${trip.name} · ${formatDateRange(trip.startDate, trip.endDate)}`} href={`/trips/${encodeURIComponent(tripId)}/places`} />
      <RouteEditor
        tripId={tripId}
        legs={views}
        dayCount={dayCount}
        otherCities={tripCities(places, trip.legs).filter((c) => !legs.some((l) => l.city === c))}
        canEdit={canEditTripStructure(me)}
      />
    </div>
  );
}
