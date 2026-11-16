import { PersonalExpenseForm } from "@/components/expenses/PersonalExpenseForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { requireTripMember } from "@/lib/api";
import { todayISO } from "@/lib/date";
import { defaultExpenseDate } from "@/lib/expense-draft";

/** Add a Personal Expense. Any role may (viewers too). */
export default async function NewPersonalExpensePage({ params }: PageProps<"/trips/[tripId]/expenses/personal/new">) {
  const { tripId } = await params;
  const { trip } = await requireTripMember(tripId);
  const back = `/trips/${encodeURIComponent(tripId)}/expenses?view=personal`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="เพิ่มค่าใช้จ่ายส่วนตัว" href={back} kind="close" />
      <PersonalExpenseForm
        tripId={tripId}
        id={null}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        initial={{
          title: "",
          category: "shopping",
          amount: 0,
          method: "cash",
          date: defaultExpenseDate(todayISO(), trip),
          note: "",
        }}
      />
    </div>
  );
}
