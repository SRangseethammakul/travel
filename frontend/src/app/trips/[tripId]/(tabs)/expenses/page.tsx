import Link from "next/link";
import { TabPageHeader } from "@/components/trip/TabPageHeader";
import { Fab } from "@/components/ui/Fab";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import { expenseCategoryStyle } from "@/components/ui/colors";
import { getExpenses, getMembers, getPersonalExpenses, getTripBalances, requireTripMember } from "@/lib/api";
import type { Member, PersonalExpense, Trip } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { groupExpensesByDay, personalTotals, shareCaption } from "@/lib/expenses";
import { paymentMethodLabel } from "@/lib/labels";
import { canAddExpense } from "@/lib/permissions";

type View = "group" | "personal";

/** กลุ่ม | ส่วนตัว switch; state lives in `?view=personal`. */
function ViewSwitch({ base, view }: { base: string; view: View }) {
  return (
    <Segmented
      label="มุมมองค่าใช้จ่าย"
      value={view}
      options={[
        { value: "group", label: "กลุ่ม", href: `${base}/expenses` },
        { value: "personal", label: "ส่วนตัว", href: `${base}/expenses?view=personal` },
      ]}
    />
  );
}

export default async function ExpensesPage({ params, searchParams }: PageProps<"/trips/[tripId]/expenses">) {
  const { tripId } = await params;
  const view: View = (await searchParams).view === "personal" ? "personal" : "group";
  const { trip, me } = await requireTripMember(tripId);
  if (view === "personal") return <PersonalView trip={trip} me={me} />;
  const [expenses, members, balances] = await Promise.all([getExpenses(tripId), getMembers(tripId), getTripBalances(tripId)]);

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const mine = balances.rows.find((r) => r.member.id === me.id);
  const share = mine?.share ?? 0;
  // The card shows Outstanding (after confirmed Settlements), not Net Balance.
  const outstanding = mine?.outstanding ?? 0;
  const days = groupExpensesByDay(expenses, trip);
  const canAdd = canAddExpense(me);
  const status = outstanding > 0 ? "จะได้คืน" : outstanding < 0 ? "ค้างจ่าย" : expenses.length ? "เคลียร์แล้ว" : "ยังไม่มียอด";

  return (
    <>
      <TabPageHeader caption={trip.name} title="ค่าใช้จ่าย">
        <ViewSwitch base={base} view="group" />
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
                const caption = shareCaption(e, me.id);
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
                          {caption.kind === "each" ? (
                            <>
                              คนละ {caption.approx ? "~" : ""}
                              <Money value={caption.amount} className="font-sans" />
                            </>
                          ) : caption.kind === "mine" ? (
                            <>
                              ส่วนคุณ <Money value={caption.amount} className="font-sans" />
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
            {canAdd ? (
              <p className="m-0 text-[13px] text-ink-muted">ใครจ่ายอะไรไปก่อน กด &quot;เพิ่มค่าใช้จ่าย&quot; แล้วระบบจะหารให้</p>
            ) : null}
          </div>
        ) : null}
      </main>

      {/* Viewers only look at group Expenses; their own Personal Expenses keep the FAB. */}
      {canAdd ? <Fab href={`${base}/expenses/new`} label="เพิ่มค่าใช้จ่าย" /> : null}
    </>
  );
}

/**
 * ส่วนตัว view: what this trip cost me (my group Shares + my Personal Expenses)
 * and my own records by day. Personal Expenses never reach group totals.
 */
async function PersonalView({ trip, me }: { trip: Trip; me: Member }) {
  const [records, balances] = await Promise.all([getPersonalExpenses(trip.id), getTripBalances(trip.id)]);
  const base = `/trips/${encodeURIComponent(trip.id)}`;
  const groupShare = balances.rows.find((r) => r.member.id === me.id)?.share ?? 0;
  const personal = personalTotals(records);
  const days = groupExpensesByDay(records, trip);

  return (
    <>
      <TabPageHeader caption={trip.name} title="ค่าใช้จ่าย">
        <ViewSwitch base={base} view="personal" />
        <section aria-label="ยอดที่ฉันใช้" className="mt-0.5 flex flex-col gap-1 rounded-tile bg-ink p-3.5 text-surface">
          <span className="text-[13px] text-on-ink-muted">ทริปนี้ฉันใช้</span>
          <Money value={groupShare + personal.total} className="text-[22px] font-semibold" />
          <span className="text-xs text-on-ink-muted">
            ส่วนในกลุ่ม <Money value={groupShare} className="font-sans" /> · ส่วนตัว <Money value={personal.total} className="font-sans" />
          </span>
          {personal.byCategory.length ? (
            <ul aria-label="ค่าใช้จ่ายส่วนตัวตามหมวด" className="m-0 mt-2 flex list-none flex-col gap-1 border-t border-ink-divider p-0 pt-2.5 text-[13px] text-on-ink-soft">
              {personal.byCategory.map((c) => (
                <li key={c.category} className="flex justify-between gap-3">
                  <span>{expenseCategoryStyle[c.category].label}</span>
                  <Money value={c.amount} className="font-sans" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </TabPageHeader>

      <main className="flex flex-col gap-[18px] px-5 pt-1 pb-24">
        {days.length ? (
          <p className="m-0 -mb-2 flex items-center gap-1 text-xs text-ink-muted">
            <Icon name="lock" size={14} />
            เห็นแค่คุณคนเดียว ไม่นับรวมในยอดของกลุ่ม
          </p>
        ) : null}
        {days.map((d) => (
          <section key={d.date} aria-labelledby={`pday-${d.date}`} className="flex flex-col gap-2">
            <h2 id={`pday-${d.date}`} className="m-0 flex justify-between text-sm font-semibold text-ink-muted">
              <span>{d.label}</span>
              <Money value={d.total} className="font-sans" />
            </h2>
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
              {d.items.map((r) => (
                <PersonalRow key={r.id} record={r} href={`${base}/expenses/personal/${encodeURIComponent(r.id)}`} />
              ))}
            </ul>
          </section>
        ))}
        {!days.length ? (
          <div className="flex flex-col items-center gap-2 rounded-tile bg-surface px-5 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-chip bg-primary-soft text-primary">
              <Icon name="wallet" size={22} />
            </span>
            <p className="m-0 font-semibold">ยังไม่มีค่าใช้จ่ายส่วนตัว</p>
            <p className="m-0 text-[13px] text-ink-muted">จดของที่ซื้อเอง เช่น ของฝาก ช็อปปิ้ง เห็นแค่คุณคนเดียว และไม่นำไปหารกับใคร</p>
          </div>
        ) : null}
      </main>

      <Fab href={`${base}/expenses/personal/new`} label="เพิ่มรายการส่วนตัว" />
    </>
  );
}

function PersonalRow({ record, href }: { record: PersonalExpense; href: string }) {
  const style = expenseCategoryStyle[record.category];
  return (
    <li className="border-b border-line-soft last:border-b-0">
      <Link href={href} className="flex items-center gap-3 p-3.5 text-ink no-underline hover:bg-surface-alt hover:text-ink">
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
          <span className="font-semibold">{record.title}</span>
          <span className="text-[13px] text-ink-muted">
            <span className="sr-only">{style.label} · </span>
            {paymentMethodLabel[record.method]}
          </span>
        </span>
        <Money value={record.amount} className="shrink-0 text-base font-semibold" />
      </Link>
    </li>
  );
}
