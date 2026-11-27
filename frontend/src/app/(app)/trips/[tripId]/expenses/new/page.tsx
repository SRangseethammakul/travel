import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { expenseFormInitial } from "@/components/expenses/form-initial";
import { BackHeader } from "@/components/ui/BackHeader";
import { getExpenses, getMembers, getPersonalExpenses, getPlaces, getPlanItems, requireTripMember } from "@/lib/api";
import { usedCardNames } from "@/lib/card-name";
import { transitModeLabel } from "@/lib/labels";
import { todayISO } from "@/lib/date";
import { defaultExpenseDate } from "@/lib/expense-draft";
import { canAddExpense } from "@/lib/permissions";

export default async function AddExpensePage({ params, searchParams }: PageProps<"/trips/[tripId]/expenses/new">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const back = `/trips/${encodeURIComponent(tripId)}/expenses`;
  if (!canAddExpense(me)) redirect(back);
  const sp = await searchParams;
  const [members, items, places, expenses, personal] = await Promise.all([
    getMembers(tripId),
    getPlanItems(tripId),
    getPlaces(tripId),
    getExpenses(tripId),
    getPersonalExpenses(tripId),
  ]);
  // From AddTransit ("บันทึกเป็นค่าใช้จ่ายด้วย"): prefill a "เดินทาง" expense linked to that Transit.
  const transit = items.find((i) => i.kind === "transit" && i.id === sp.transit && !i.expenseId);
  const initial = expenseFormInitial(null, { me, members, defaultDate: defaultExpenseDate(todayISO(), trip) });
  if (transit && transit.kind === "transit") {
    const amount = Number(sp.amount);
    initial.title = `${transitModeLabel[transit.mode]} ${transit.fromCode ?? transit.fromText} → ${transit.toCode ?? transit.toText}`;
    initial.category = "transport";
    initial.date = defaultExpenseDate(transit.departAt.slice(0, 10), trip);
    if (Number.isSafeInteger(amount) && amount > 0) initial.amount = amount;
  }
  // From AddPlace ("บันทึกเป็นค่าใช้จ่ายด้วย" on a hotel): prefill a "ที่พัก" expense from its stay.
  const hotel = places.find((p) => p.id === sp.stay && p.type === "stay" && p.stay && !p.stay.expenseId);
  if (hotel?.stay) {
    initial.title = `ที่พัก ${hotel.name}`;
    initial.category = "stay";
    initial.date = defaultExpenseDate(hotel.stay.checkIn, trip);
    if (hotel.stay.price) initial.amount = hotel.stay.price;
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="เพิ่มค่าใช้จ่าย" href={back} kind="close" />
      <ExpenseForm
        tripId={tripId}
        expenseId={null}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        members={members.map((m) => ({ id: m.id, name: m.displayName, color: m.color, avatarUrl: m.avatarUrl }))}
        initial={initial}
        usedCardNames={usedCardNames(expenses, personal)}
        {...(transit ? { transitId: transit.id } : {})}
        {...(hotel ? { stayPlaceId: hotel.id } : {})}
      />
    </div>
  );
}
