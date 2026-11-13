import type { Metadata } from "next";
import Link from "next/link";
import { AccountButton } from "@/components/trip/AccountButton";
import { JoinLinkButton } from "@/components/trip/JoinLinkButton";
import { AvatarStack } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { solidBg } from "@/components/ui/colors";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import { getCurrentUser, getExpenses, getMembers, getSettlements, getTripBalances, listMyTrips } from "@/lib/api";
import { cn } from "@/lib/cn";
import { todayISO } from "@/lib/date";
import { outstandingBalances } from "@/lib/money/balance";
import { formatMoney } from "@/lib/money/format";
import { parseTripsTab, tripCardStatus, tripTab, type TripsTab } from "@/lib/trips";

export const metadata: Metadata = { title: "ทริปของฉัน · [ชื่อแอป]" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const tab = parseTripsTab(first((await searchParams).tab));
  const today = todayISO();
  const [user, mine] = await Promise.all([getCurrentUser(), listMyTrips()]);

  const cards = await Promise.all(
    mine.map(async ({ trip, outstanding: myOutstanding }) => {
      // My Outstanding comes with the trip list (A2); members and totals load per trip.
      const [members, balances, expenses, settlements] = await Promise.all([
        getMembers(trip.id),
        getTripBalances(trip.id),
        getExpenses(trip.id),
        getSettlements(trip.id),
      ]);
      // A viewer's balances hold only their own row, so "everyone settled" is
      // computed from the whole-trip Expenses and Settlements every role can read.
      const everyoneSettled = Object.values(
        outstandingBalances(members.map((m) => m.id), expenses, settlements),
      ).every((v) => v === 0);
      return {
        trip,
        members,
        total: balances.total,
        myOutstanding,
        tab: tripTab(today, trip.startDate, trip.endDate),
        status: tripCardStatus(today, trip, myOutstanding, everyoneSettled),
      };
    }),
  );
  // Upcoming: soonest first. Past: most recent first.
  const shown = cards.filter((c) => c.tab === tab);
  if (tab === "past") shown.reverse();
  const counts: Record<TripsTab, number> = {
    upcoming: cards.filter((c) => c.tab === "upcoming").length,
    past: cards.filter((c) => c.tab === "past").length,
  };

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex flex-col gap-3.5 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-muted">สวัสดี {user.name}</span>
            <h1 className="m-0 font-display text-[26px] font-semibold">ทริปของฉัน</h1>
          </div>
          <AccountButton user={user} />
        </div>
        <Segmented
          label="สถานะทริป"
          value={tab}
          options={[
            { value: "upcoming", label: "กำลังจะไป", href: "/trips" },
            { value: "past", label: "ผ่านมาแล้ว", href: "/trips?tab=past" },
          ]}
        />
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pt-1 pb-[110px]">
        {shown.length ? (
          <ul aria-label={tab === "past" ? "ทริปที่ผ่านมาแล้ว" : "ทริปที่กำลังจะไป"} className="m-0 flex list-none flex-col gap-3 p-0 sm:grid sm:grid-cols-2">
            {shown.map(({ trip, members, total, myOutstanding, status }) => {
              const hasExpenses = total > 0;
              const meta = `${members.length} คน · ${hasExpenses ? `${tab === "upcoming" ? "ใช้ไป " : ""}${formatMoney(total)}` : "ยังไม่มีค่าใช้จ่าย"}`;
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${encodeURIComponent(trip.id)}`}
                    className="flex flex-col overflow-hidden rounded-[22px] bg-surface text-ink no-underline transition-shadow duration-150 hover:text-ink hover:shadow-seg"
                  >
                    <div className={cn("flex flex-col gap-1 p-4 text-surface", solidBg[trip.cover])}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] opacity-90">{trip.destination}</span>
                        <span className="shrink-0 rounded-full bg-surface/95 px-2.5 py-[3px] text-xs font-semibold text-ink">{status.badge}</span>
                      </div>
                      <span className="font-display text-xl font-semibold">{trip.name}</span>
                      <span className="text-[13px] opacity-90">{status.dates}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <AvatarStack people={members.map((m) => ({ id: m.id, name: m.displayName, color: m.color }))} />
                      <span className="flex-1 pl-1.5 text-[13px] text-ink-muted">{meta}</span>
                      {hasExpenses ? (
                        <span className="text-[13px] font-semibold">
                          <span className="sr-only">{myOutstanding > 0 ? "คุณได้คืน" : myOutstanding < 0 ? "คุณค้างจ่าย" : "ยอดของคุณ"} </span>
                          <Money value={myOutstanding} sign={myOutstanding ? "always" : "auto"} tone="balance" className="font-sans" />
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 rounded-card bg-surface px-4 py-6 text-center text-sm text-ink-muted">
            {tab === "past"
              ? "ยังไม่มีทริปที่ผ่านมาแล้ว"
              : counts.past
                ? "ยังไม่มีทริปที่กำลังจะไป สร้างทริปใหม่หรือเข้าร่วมทริปของเพื่อนได้เลย"
                : "ยังไม่มีทริป เริ่มจากสร้างทริปใหม่ หรือเข้าร่วมด้วยลิงก์เชิญจากเพื่อน"}
          </p>
        )}

        <JoinLinkButton />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-app bg-bg px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        <Link href="/trips/new" className={buttonClasses({ size: "lg", block: true, className: "h-[54px] rounded-2xl hover:text-surface" })}>
          <Icon name="plus" size={18} />
          สร้างทริปใหม่
        </Link>
      </div>
    </div>
  );
}
