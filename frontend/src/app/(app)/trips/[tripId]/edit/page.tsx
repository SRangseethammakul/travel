import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditTripForm } from "@/components/trip/EditTripForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { requireTripMember } from "@/lib/api";
import { canEditTripStructure } from "@/lib/permissions";

export const metadata: Metadata = { title: "แก้ไขทริป · Plan Trip" };

/** "แก้ไขทริป" (owner only, B2). No mockup: CreateTrip's fields, kept minimal. */
export default async function EditTripPage({ params }: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const back = `/trips/${encodeURIComponent(tripId)}`;
  if (!canEditTripStructure(me)) redirect(back);
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="แก้ไขทริป" href={back} />
      <EditTripForm
        tripId={tripId}
        initial={{ name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate }}
      />
    </div>
  );
}
