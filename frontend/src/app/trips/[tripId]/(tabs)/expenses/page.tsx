import Link from "next/link";
import { TabPageHeader } from "@/components/trip/TabPageHeader";
import { Fab } from "@/components/ui/Fab";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { expenseCategoryStyle } from "@/components/ui/colors";
import { getExpenses, getMembers, getTripBalances, requireTripMember } from "@/lib/api";
import { cn } from "@/lib/cn";
import { equalShareAmount, groupExpensesByDay } from "@/lib/expenses";

export default async function ExpensesPage({ params }: PageProps<"/trips/[tripId]/expenses">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [expenses, members, balances] = await Promise.all([getExpenses(tripId), getMembers(tripId), getTripBalances(tripId)]);

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const mine = balances.rows.find((r) => r.member.id === me.id);
  const share = mine?.share ?? 0;
  // The card shows Outstanding (after confirmed Settlements), not Net Balance.
  const outstanding = mine?.outstanding ?? 0;
  const days = groupExpensesByDay(expenses, trip);
  const status = outstanding > 0 ? "จะได้คืน" : outstanding < 0 ? "ค้างจ่าย" : expenses.length ? "เคลียร์แล้ว" : "ยังไม่มียอด";

  return (
    <>
      <TabPageHeader caption={trip.name} title="ค่าใช้จ่าย">
        <section aria-label="ยอดรวม" className="mt-0.5 grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-tile bg-ink p-3.5 text-surface">
            <span className="text-[13px] text-on-ink-muted">ยอดรวมทั้งทริป</span>
            <Money value={balances.total} className="text-[22px] font-semibold" />
            <span className="text-xs text-on-ink-muted">
              {expenses.length} รายการ · {members.length} คน
            </span>
          </div>
          <Link
            href={`${base}/summary`}
            className={cn(
              "flex flex-col gap-1 rounded-tile p-3.5 no-underline transition-colors",
              outstanding < 0
                ? "bg-danger-soft text-danger-ink hover:text-danger-ink"
                : "bg-primary-soft text-primary-ink-strong hover:bg-primary-highlight/60 hover:text-primary-ink-strong",
            )}
          >
            <span className={cn("text-[13px]", outstanding < 0 ? "text-danger-ink" : "text-primary-ink-soft")}>
              ส่วนของคุณ <Money value={share} className="font-sans" />
            </span>
            <Money
              value={outstanding}
              sign="always"
              className={cn("text-[22px] font-semibold", outstanding > 0 ? "text-primary" : outstanding < 0 ? "text-danger" : "text-ink-muted")}
            />
            <span className={cn("flex items-center gap-1 text-xs", outstanding < 0 ? "text-danger-ink" : "text-primary-ink-soft")}>
              {status} · ดูสรุป
              <Icon name="chevronRight" size={14} />
            </span>
          </Link>
        </section>
      </TabPageHeader>

      <main className="flex flex-col gap-[18px] px-5 pt-1 pb-24">
        {days.map((d) => (
          <section key={d.date} aria-labelledby={`day-${d.date}`} className="flex flex-col gap-2">
            <h2 id={`day-${d.date}`} className="m-0 flex justify-between text-sm font-semibold text-ink-muted">
              <span>{d.label}</span>
              <Money value={d.total} className="font-sans" />
            </h2>
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
              {d.items.map((e) => {
                const style = expenseCategoryStyle[e.category];
                const each = equalShareAmount(e);
                const myShare = e.shares.find((s) => s.memberId === me.id)?.amount;
                return (
                  <li key={e.id} className="border-b border-line-soft last:border-b-0">
                    <Link
                      href={`${base}/expenses/${encodeURIComponent(e.id)}`}
                      className="flex items-center gap-3 p-3.5 text-ink no-underline hover:bg-surface-alt hover:text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-[42px] shrink-0 items-center justify-center rounded-chip font-display font-semibold",
                          style.abbr.length > 4 ? "text-[11px]" : "text-[13px]",
                          style.tint,
                          style.ink,
                        )}
                      >
                        {style.abbr}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold">{e.title}</span>
                        <span className="text-[13px] text-ink-muted">
                          <span className="sr-only">{style.label} · </span>
                          {names.get(e.payerId)} จ่าย · หาร {e.shares.length} คน
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <Money value={e.amount} className="text-base font-semibold" />
                        <span className="text-xs text-ink-muted">
                          {each !== null ? (
                            <>
                              คนละ <Money value={each} className="font-sans" />
                            </>
                          ) : myShare !== undefined ? (
                            <>
                              ส่วนคุณ <Money value={myShare} className="font-sans" />
                            </>
                          ) : (
                            "แบ่งไม่เท่ากัน"
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!days.length ? (
          <div className="flex flex-col items-center gap-2 rounded-tile bg-surface px-5 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-chip bg-primary-soft text-primary">
              <Icon name="receipt" size={22} />
            </span>
            <p className="m-0 font-semibold">ยังไม่มีค่าใช้จ่าย</p>
            <p className="m-0 text-[13px] text-ink-muted">ใครจ่ายอะไรไปก่อน กด &quot;เพิ่มค่าใช้จ่าย&quot; แล้วระบบจะหารให้</p>
          </div>
        ) : null}
      </main>

      <Fab href={`${base}/expenses/new`} label="เพิ่มค่าใช้จ่าย" />
    </>
  );
}
