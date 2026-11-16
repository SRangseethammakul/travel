import { notFound } from "next/navigation";
import { DeletePersonalExpenseButton } from "@/components/expenses/DeletePersonalExpenseButton";
import { PersonalExpenseForm } from "@/components/expenses/PersonalExpenseForm";
import { BackHeader } from "@/components/ui/BackHeader";
import { getExpenses, getPersonalExpenses, requireTripMember } from "@/lib/api";
import { usedCardNames } from "@/lib/card-name";

/** Edit or delete one of my Personal Expenses. B44 lists only my own, so anyone else's id is a 404. */
export default async function EditPersonalExpensePage({ params }: PageProps<"/trips/[tripId]/expenses/personal/[id]">) {
  const { tripId, id } = await params;
  const { trip } = await requireTripMember(tripId);
  const [personal, expenses] = await Promise.all([getPersonalExpenses(tripId), getExpenses(tripId)]);
  const record = personal.find((r) => r.id === id);
  if (!record) notFound();
  const back = `/trips/${encodeURIComponent(tripId)}/expenses?view=personal`;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="แก้ไขค่าใช้จ่ายส่วนตัว" href={back} kind="close" />
      <PersonalExpenseForm
        tripId={tripId}
        id={record.id}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        usedCardNames={usedCardNames(expenses, personal)}
        initial={{
          title: record.title,
          category: record.category,
          amount: record.amount,
          method: record.method,
          cardName: record.cardName ?? "",
          date: record.date,
          note: record.note ?? "",
        }}
      >
        <DeletePersonalExpenseButton tripId={tripId} id={record.id} title={record.title} />
      </PersonalExpenseForm>
    </div>
  );
}
