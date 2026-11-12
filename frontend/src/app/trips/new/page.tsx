import type { Metadata } from "next";
import { CreateTripForm } from "@/components/trip/CreateTripForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { getCurrentUser } from "@/lib/api";
import { addDays, todayISO } from "@/lib/date";

export const metadata: Metadata = { title: "สร้างทริปใหม่ · [ชื่อแอป]" };

export default async function CreateTripPage() {
  const user = await getCurrentUser();
  // Default dates: a 4-day trip starting in two weeks (people change them anyway).
  const start = addDays(todayISO(), 14);
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="สร้างทริปใหม่" href="/trips" />
      <CreateTripForm me={{ name: user.name, color: user.color }} defaultStart={start} defaultEnd={addDays(start, 3)} />
    </div>
  );
}
