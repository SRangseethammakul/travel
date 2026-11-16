import { redirect } from "next/navigation";
import { AddToPlanHeader } from "@/components/plan/AddToPlanHeader";
import { PickPlaceForm } from "@/components/plan/PickPlaceForm";
import { getPlaces, getPlanItems, getTripTags, requireTripMember } from "@/lib/api";
import { formatWeekdayDay, todayISO, tripDayDate } from "@/lib/date";
import { canEditPlan } from "@/lib/permissions";
import { legCity, resolveDay, tripDayCount } from "@/lib/plan";
import { stayTripDays } from "@/lib/place-form";
import { pickSections } from "@/lib/plan-form";
import { citySlug, tripCities } from "@/lib/places";

export default async function PickPlacePage({ params, searchParams }: PageProps<"/trips/[tripId]/plan/add">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const day = resolveDay(sp.day, trip, todayISO());
  if (!canEditPlan(me)) redirect(`${base}/plan?day=${day}`);

  const [places, items, tags] = await Promise.all([getPlaces(tripId), getPlanItems(tripId), getTripTags(tripId)]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const byId = new Map(places.map((p) => [p.id, p]));
  const sections = pickSections(places, items, trip, day).map((s) => ({
    key: s.key,
    title: s.title,
    sub: s.sub,
    rows: s.rows.map((r) => {
      const p = byId.get(r.place.id)!;
      return { id: p.id, name: p.name, type: p.type, area: p.area, city: p.city, tags: p.tagIds.flatMap((id) => tagName.get(id) ?? []), days: r.days };
    }),
  }));
  const dayCount = tripDayCount(trip);
  const placeParam = typeof sp.place === "string" ? sp.place : null;
  // Tick a day only when the user came from one (?day=) or the place is a hotel with stay dates; never a surprise day 1.
  const chosenPlace = placeParam ? byId.get(placeParam) : undefined;
  const stayDays = chosenPlace?.stay ? stayTripDays(chosenPlace.stay, trip) : [];
  const explicitDay = typeof sp.day === "string" && Number.isInteger(Number(sp.day)) && Number(sp.day) >= 1 && Number(sp.day) <= dayCount;
  const initialDays = stayDays.length ? stayDays : explicitDay ? [day] : [];
  const dayCity = trip.legs?.length ? legCity(trip.legs, day) : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <AddToPlanHeader
        title={`เพิ่มกิจกรรม · วันที่ ${day}`}
        subtitle="เลือกจากสถานที่ที่บันทึกไว้ในทริป"
        closeHref={`${base}/plan?day=${day}`}
        planBase={`${base}/plan`}
        day={day}
        current="place"
      />
      <PickPlaceForm
        key={`${day}:${placeParam ?? ""}`}
        tripId={tripId}
        sections={sections}
        days={Array.from({ length: dayCount }, (_, i) => ({ day: i + 1, sub: formatWeekdayDay(tripDayDate(trip.startDate, i + 1)) }))}
        initialDays={initialDays}
        initialPlaceId={placeParam}
        showCity={tripCities(places, trip.legs).length > 1}
        newPlaceHref={`${base}/places/new?day=${day}${dayCity ? `&city=${encodeURIComponent(citySlug(dayCity))}` : ""}`}
      />
    </div>
  );
}
