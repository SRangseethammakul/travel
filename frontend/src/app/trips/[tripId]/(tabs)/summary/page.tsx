import Link from "next/link";
import { BalanceList } from "@/components/summary/BalanceList";
import { TabPageHeader } from "@/components/trip/TabPageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { expenseCategoryStyle } from "@/components/ui/colors";
import { getExpenses, getMembers, getSettlements, getTripBalances, requireTripMember } from "@/lib/api";
import { cn } from "@/lib/cn";
import { categoryTotals, shareBreakdown, suggestedRow, transferRows, type TransferStatus } from "@/lib/expenses";
import { formatMoney } from "@/lib/money/format";

const statusStyle: Record<TransferStatus, { label: string; className: string }> = {
  confirmed: { label: "เคลียร์แล้ว", className: "border-primary bg-primary-soft text-primary hover:text-primary-hover" },
  sent: { label: "รอยืนยัน", className: "border-todo-line bg-todo-soft text-todo hover:text-todo" },
  pending: { label: "โอนเงิน", className: "border-primary bg-primary text-surface hover:bg-primary-hover hover:text-surface" },
};

export default async function SummaryPage({ params }: PageProps<"/trips/[tripId]/summary">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [expenses, settlements, balances, memberList] = await Promise.all([
    getExpenses(tripId),
    getSettlements(tripId),
    getTripBalances(tripId),
    getMembers(tripId),
  ]);

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const categories = categoryTotals(expenses);
  // A viewer's balances hold only their own row, so names come from the Member list.
  const members = new Map(memberList.map((m) => [m.id, m]));
  const transfers = transferRows(
    memberList.map((m) => m.id),
    settlements,
    balances.transfers.map(suggestedRow),
  );

  return (
    <>
      <TabPageHeader caption={trip.name} title="สรุปค่าใช้จ่าย" />

      <main className="flex flex-col gap-4 px-5 pb-6">
        <Card className="gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">ยอดรวมทั้งทริป</span>
            <Money value={balances.total} className="text-2xl font-semibold" />
          </div>
          {categories.length ? (
            <>
              <div
                role="img"
                aria-label={`สัดส่วน: ${categories.map((c) => `${expenseCategoryStyle[c.category].label} ${c.percent}%`).join(", ")}`}
                className="flex h-3 gap-0.5 overflow-hidden rounded-full"
              >
                {categories.map((c) => (
                  <div key={c.category} className={expenseCategoryStyle[c.category].bar} style={{ flexGrow: c.amount, flexBasis: 0 }} />
                ))}
              </div>
              <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0 text-[13px]">
                {categories.map((c) => (
                  <li key={c.category} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn("size-2 rounded-[2px]", expenseCategoryStyle[c.category].bar)} />
                    {expenseCategoryStyle[c.category].label} <Money value={c.amount} className="font-sans" />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="m-0 text-[13px] text-ink-muted">ยังไม่มีค่าใช้จ่ายในทริปนี้</p>
          )}
        </Card>

        <section aria-labelledby="people-title" className="flex flex-col gap-2.5">
          <h2 id="people-title" className="m-0 font-display text-[17px] font-semibold">
            แต่ละคน
          </h2>
          {/* Keyed by the Current Member so switching User re-opens on the new "คุณ". */}
          <BalanceList
            key={me.id}
            initialOpen={me.id}
            rows={balances.rows.map((r) => ({
              id: r.member.id,
              name: r.member.displayName,
              color: r.member.color,
              isMe: r.member.id === me.id,
              paid: r.paid,
              share: r.share,
              net: r.net,
              lines: shareBreakdown(r.member.id, expenses),
            }))}
          />
        </section>

        <Card className="gap-1">
          <h2 className="m-0 mb-1 font-display text-[17px] font-semibold">ใครต้องโอนให้ใคร</h2>
          <p className="m-0 mb-1.5 text-[13px] text-ink-muted">คำนวณให้โอนน้อยครั้งที่สุด</p>
          {transfers.map((t) => {
            const from = members.get(t.fromId)!;
            const to = members.get(t.toId)!;
            const s = statusStyle[t.status];
            return (
              <div key={t.key} className="flex items-center gap-2.5 border-t border-line-soft py-2.5">
                <Avatar name={from.displayName} color={from.color} size="sm" />
                <Icon name="arrowRight" size={18} className="shrink-0 text-ink-muted" />
                <Avatar name={to.displayName} color={to.color} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">
                    {from.displayName} → {to.displayName}
                  </span>
                  <Money value={t.amount} className="text-[15px] font-semibold" />
                </span>
                <Link
                  href={`${base}/summary/settle?from=${encodeURIComponent(t.fromId)}&to=${encodeURIComponent(t.toId)}`}
                  aria-label={`${s.label}: ${from.displayName} โอนให้ ${to.displayName} ${formatMoney(t.amount)}`}
                  className={cn(
                    "relative flex min-h-10 shrink-0 items-center rounded-chip border px-3 text-[13px] font-semibold no-underline before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
                    s.className,
                  )}
                >
                  {s.label}
                </Link>
              </div>
            );
          })}
          {!transfers.length ? (
            <p className="m-0 border-t border-line-soft py-3 text-[13px] text-ink-muted">
              {!expenses.length
                ? "ยังไม่มียอดที่ต้องโอน"
                : me.role === "viewer"
                  ? "คุณไม่มียอดที่ต้องโอนหรือรอรับ"
                  : "ทุกคนเคลียร์ครบแล้ว ไม่มีใครต้องโอน"}
            </p>
          ) : null}
        </Card>
      </main>
    </>
  );
}
