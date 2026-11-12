import { PlacesView } from "@/components/places/PlacesView";
import { TabPageHeader } from "@/components/trip/TabPageHeader";
import { Fab } from "@/components/ui/Fab";
import { IconLink } from "@/components/ui/IconButton";
import { getPlaces, getPlanItems, getTripTags, requireTripMember } from "@/lib/api";
import { placeDays } from "@/lib/plan";
import { parsePlaceFilters, tripCities, type PlaceRow } from "@/lib/places";

export default async function PlacesPage({ params, searchParams }: PageProps<"/trips/[tripId]/places">) {
  const { tripId } = await params;
  const { trip } = await requireTripMember(tripId);
  const [places, plan, tags] = await Promise.all([getPlaces(tripId), getPlanItems(tripId), getTripTags(tripId)]);

  const days = placeDays(plan, trip);
  const rows: PlaceRow[] = places.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city,
    area: p.area,
    tagIds: p.tagIds,
    days: days.get(p.id) ?? [],
  }));
  const cities = tripCities(rows, trip.legs);
  const filters = parsePlaceFilters(await searchParams, cities);
  const unscheduled = rows.filter((r) => !r.days.length).length;
  const base = `/trips/${encodeURIComponent(tripId)}`;

  return (
    <>
      <TabPageHeader
        caption={`${trip.name} · ${rows.length} ที่ · ยังไม่จัดวัน ${unscheduled}`}
        title="สถานที่"
        action={
          <div className="flex gap-2">
            {cities.length > 1 ? <IconLink href={`${base}/route`} icon="route" label="เส้นทางเมือง" /> : null}
            <IconLink href={`${base}/places/tags`} icon="tag" label="จัดการ tag และย่าน" />
          </div>
        }
      />
      <PlacesView rows={rows} tags={tags.map((t) => [t.id, t.name])} cities={cities} filters={filters} base={base} />
      <Fab href={`${base}/places/new${filters.city !== "all" ? `?city=${encodeURIComponent(filters.city)}` : ""}`} label="เพิ่มสถานที่" />
    </>
  );
}
