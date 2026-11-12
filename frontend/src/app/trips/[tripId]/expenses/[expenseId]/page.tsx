import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteExpenseButton } from "@/components/expenses/DeleteExpenseButton";
import { SlipButton } from "@/components/expenses/SlipButton";
import { Avatar } from "@/components/ui/Avatar";
import { BackHeader } from "@/components/ui/BackHeader";
import { Pill } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import { Money } from "@/components/ui/Money";
import { getDocument, getDocumentUrl, getExpense, getMembers, requireTripMember } from "@/lib/api";
import type { PaymentMethod } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { daysBetween, formatDate, formatTimestamp } from "@/lib/date";
import { equalShareAmount } from "@/lib/expenses";
import { expenseCategoryFormLabel, paymentMethodLabel, splitModeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money/format";
import { canEditExpense } from "@/lib/permissions";

const methodStyle: Record<PaymentMethod, { icon: IconName; tint: string }> = {
  cash: { icon: "cash", tint: "bg-primary-soft text-primary" },
  promptpay: { icon: "transfer", tint: "bg-transit-soft text-type-transit" },
  card: { icon: "card", tint: "bg-interest-soft text-type-interest" },
  wallet: { icon: "wallet", tint: "bg-todo-soft text-type-food" },
};

export default async function ExpenseDetailPage({ params }: PageProps<"/trips/[tripId]/expenses/[expenseId]">) {
  const { tripId, expenseId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [expense, members] = await Promise.all([getExpense(tripId, expenseId), getMembers(tripId)]);
  if (!expense) notFound();
  const [slip, slipUrl] = expense.slipDocId
    ? await Promise.all([getDocument(tripId, expense.slipDocId), getDocumentUrl(tripId, expense.slipDocId)])
    : [null, null];

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const byId = new Map(members.map((m) => [m.id, m]));
  const payer = byId.get(expense.payerId);
  const name = (id: string | undefined) => (id ? (byId.get(id)?.displayName ?? "สมาชิก") : "");
  const canEdit = canEditExpense(me, expense);
  const offset = daysBetween(trip.startDate, expense.date);
  const inTrip = offset >= 0 && expense.date <= trip.endDate;
  const each = expense.splitMode === "equal" ? equalShareAmount(expense) : null;
  const totalWeight = expense.shares.reduce((s, x) => s + (x.weight ?? 0), 0);
  const method = methodStyle[expense.method];

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader
        title="รายละเอียด"
        href={`${base}/expenses`}
        action={canEdit ? <IconLink href={`${base}/expenses/${encodeURIComponent(expense.id)}/edit`} icon="edit" label="แก้ไขรายการ" /> : undefined}
      />

      <main className="flex flex-col gap-3.5 px-5 pt-2 pb-6">
        <section className="flex flex-col items-center gap-2 rounded-[22px] bg-surface px-4 py-5 text-center">
          <Pill>{expenseCategoryFormLabel[expense.category]}</Pill>
          <h2 className="m-0 text-[17px] font-semibold">{expense.title}</h2>
          <Money value={expense.amount} className="text-[38px] leading-[1.1] font-semibold" />
          <span className="text-[13px] text-ink-muted">
            {formatDate(expense.date)}
            {inTrip ? ` · วันที่ ${offset + 1}` : ""}
          </span>
        </section>

        <section aria-label="การจ่าย" className="flex flex-col rounded-card bg-surface px-4 py-1">
          <div className="flex items-center gap-3 border-b border-line-soft py-3">
            {payer ? <Avatar name={payer.displayName} color={payer.color} size="md" /> : null}
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] text-ink-muted">จ่ายโดย</span>
              <span className="font-semibold">
                {name(expense.payerId)}
                {expense.payerId === me.id ? " (คุณ)" : ""}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", method.tint)}>
              <Icon name={method.icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] text-ink-muted">ช่องทางชำระ</span>
              <span className="font-semibold">
                {paymentMethodLabel[expense.method]}
                {expense.cardLast4 ? <span className="font-normal text-ink-muted"> · ลงท้าย {expense.cardLast4}</span> : null}
              </span>
            </span>
            {slip ? <SlipButton name={slip.name} size={slip.size} mime={slip.mime} label="ดูใบเสร็จ" url={slipUrl} /> : null}
          </div>
        </section>

        <section aria-labelledby="split-title" className="flex flex-col gap-1 rounded-card bg-surface p-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h2 id="split-title" className="m-0 font-display text-base font-semibold">
              {splitModeLabel[expense.splitMode].title} {expense.shares.length} คน
            </h2>
            <span className="text-[13px] text-ink-muted">
              {each !== null ? `คนละ ${formatMoney(each)}` : expense.splitMode === "shares" ? `รวม ${totalWeight} ส่วน` : null}
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {expense.shares.map((s) => {
              const m = byId.get(s.memberId);
              const isPayer = s.memberId === expense.payerId;
              return (
                <li key={s.memberId} className="flex min-h-12 items-center gap-3">
                  {m ? <Avatar name={m.displayName} color={m.color} size="sm" /> : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {name(s.memberId)}
                      {s.memberId === me.id ? <span className="font-normal text-ink-muted"> (คุณ)</span> : null}
                    </span>
                    <span className={cn("text-xs", isPayer ? "text-primary" : "text-ink-muted")}>
                      {isPayer ? `ผู้จ่าย · สำรองจ่ายไปก่อน ${formatMoney(expense.amount)}` : "ส่วนที่ต้องรับผิดชอบ"}
                      {s.weight ? ` · ${s.weight} ส่วน` : ""}
                    </span>
                  </span>
                  <Money value={s.amount} className="text-[15px] font-semibold" />
                </li>
              );
            })}
          </ul>
          {!expense.shares.some((s) => s.memberId === expense.payerId) ? (
            <p className="m-0 text-xs text-ink-muted">{name(expense.payerId)} จ่ายแทน ไม่ได้ร่วมหารรายการนี้</p>
          ) : null}
          <Link href={`${base}/summary`} className="mt-1.5 flex min-h-11 items-center border-t border-line-soft pt-1 text-[13px] no-underline">
            การโอนคืนคิดรวมทั้งทริป · ดูที่หน้าสรุป
          </Link>
        </section>

        {expense.note ? (
          <section aria-labelledby="note-title" className="flex flex-col gap-1.5 rounded-card bg-surface p-4">
            <h2 id="note-title" className="m-0 text-sm font-semibold">
              โน้ต
            </h2>
            <p className="m-0 text-sm leading-[1.55] text-ink-subtle">{expense.note}</p>
          </section>
        ) : null}

        <p className="m-0 text-center text-xs text-ink-muted">
          เพิ่มโดย {name(expense.createdBy)} · {formatTimestamp(expense.createdAt)}
          {expense.updatedBy ? ` · แก้ไขล่าสุดโดย ${name(expense.updatedBy)}` : ""}
        </p>

        {canEdit ? (
          <DeleteExpenseButton tripId={tripId} expenseId={expense.id} title={expense.title} />
        ) : (
          <p className="m-0 rounded-icon bg-surface px-4 py-3 text-center text-[13px] text-ink-muted">
            แก้หรือลบได้เฉพาะ {name(expense.createdBy)} ที่เพิ่มรายการนี้ หรือผู้จัดทริป
          </p>
        )}
      </main>
    </div>
  );
}
