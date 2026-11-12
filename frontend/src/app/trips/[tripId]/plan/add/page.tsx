import { redirect } from "next/navigation";
import { AddToPlanHeader } from "@/components/plan/AddToPlanHeader";
import { PickPlaceForm } from "@/components/plan/PickPlaceForm";
import { getPlaces, getPlanItems, getTripTags, requireTripMember } from "@/lib/api";
import { formatWeekdayDay, todayISO, tripDayDate } from "@/lib/date";
import { canEditPlan } from "@/lib/permissions";
import { resolveDay, tripDayCount } from "@/lib/plan";
import { pickSections } from "@/lib/plan-form";
import { tripCities } from "@/lib/places";

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

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <AddToPlanHeader
        title={`เพิ่มกิจกรรม · วันที่ ${day}`}
        subtitle="เลือกจากสถานที่ในลิสต์ของทริป"
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
        initialDay={day}
        initialPlaceId={placeParam}
        showCity={tripCities(places, trip.legs).length > 1}
        newPlaceHref={`${base}/places/new`}
      />
    </div>
  );
}
