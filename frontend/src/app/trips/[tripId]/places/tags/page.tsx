import { TagManager } from "@/components/places/TagManager";
import { BackHeader } from "@/components/ui/BackHeader";
import { getPlaces, getUserTags, requireTripMember } from "@/lib/api";
import { getTagUsage } from "@/lib/api/plan-queries";
import { canEditTripStructure } from "@/lib/permissions";
import { areasInCity } from "@/lib/place-form";
import { tripCities } from "@/lib/places";

export default async function ManageTagsPage({ params }: PageProps<"/trips/[tripId]/places/tags">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  // Only the Current User's tags (Tag belongs to a User, first-frontend.md).
  const [tags, usage, places] = await Promise.all([getUserTags(), getTagUsage(), getPlaces(tripId)]);
  const cities = tripCities(places, trip.legs).filter((c) => places.some((p) => p.city === c));

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader title="จัดการ tag" subtitle="tag ของคุณใช้ได้กับทุกทริป" href={`/trips/${encodeURIComponent(tripId)}/places`} />
      <TagManager
        tripId={tripId}
        canEditAreas={canEditTripStructure(me)}
        tags={tags.map((t) => ({ id: t.id, name: t.name, group: t.group, ...(t.color ? { color: t.color } : {}), count: usage[t.id] ?? 0 }))}
        areas={cities.map((city) => ({ city, areas: areasInCity(places, city) }))}
      />
    </div>
  );
}
