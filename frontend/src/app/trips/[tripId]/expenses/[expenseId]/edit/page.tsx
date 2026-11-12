import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { expenseFormInitial } from "@/components/expenses/form-initial";
import { BackHeader } from "@/components/ui/BackHeader";
import { getDocument, getExpense, getMembers, requireTripMember } from "@/lib/api";
import { canEditExpense } from "@/lib/permissions";

export default async function EditExpensePage({ params }: PageProps<"/trips/[tripId]/expenses/[expenseId]/edit">) {
  const { tripId, expenseId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const expense = await getExpense(tripId, expenseId);
  if (!expense) notFound();
  const detail = `/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`;
  if (!canEditExpense(me, expense)) redirect(detail);
  const [members, slip] = await Promise.all([
    getMembers(tripId),
    expense.slipDocId ? getDocument(tripId, expense.slipDocId) : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <BackHeader title="แก้ไขค่าใช้จ่าย" href={detail} kind="close" />
      <ExpenseForm
        tripId={tripId}
        expenseId={expense.id}
        trip={{ startDate: trip.startDate, endDate: trip.endDate }}
        members={members.map((m) => ({ id: m.id, name: m.displayName, color: m.color }))}
        initial={expenseFormInitial(expense, { me, members, defaultDate: expense.date, slipName: slip?.name ?? null })}
      />
    </div>
  );
}
