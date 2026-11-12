import Link from "next/link";
import type { ReactNode } from "react";
import { CopyInviteButton } from "@/components/trip/CopyInviteButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { DayStrip } from "@/components/trip/DayStrip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import { Money } from "@/components/ui/Money";
import {
  getActivity,
  getChecklist,
  getCurrentUser,
  getInvite,
  getMembers,
  getPlaces,
  getPlanItems,
  getDocuments,
  getTripBalances,
  requireTripMember,
} from "@/lib/api";
import type { ChecklistItem, Place, PlanItem, TransitPlanItem, Trip } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatCountdown, formatDateRange, formatDayMonth, formatTripLength, formatWeekdayDay, todayISO, tripDayDate, tripPhase } from "@/lib/date";
import { unreadCount } from "@/lib/expenses";
import { memberRoleLine, transitModeLabel } from "@/lib/labels";
import { dayCardCaption, itemsByDay, resolveDay } from "@/lib/plan";

export default async function TripPage({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const [user, members, places, balances, plan, checklist, activity, invite, documents] = await Promise.all([
    getCurrentUser(),
    getMembers(tripId),
    getPlaces(tripId),
    getTripBalances(tripId),
    getPlanItems(tripId),
    getChecklist(tripId),
    getActivity(tripId),
    getInvite(tripId),
    getDocuments(tripId),
  ]);
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const today = todayISO();
  const unread = unreadCount(activity, user.id, me.id);
  const days = itemsByDay(plan, trip);
  const currentDay = resolveDay(undefined, trip, today);
  const phase = tripPhase(today, trip.startDate, trip.endDate);

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <Link href="/trips" className="-ml-1 flex min-h-11 items-center gap-1.5 px-1 text-[15px] font-semibold text-ink no-underline hover:text-ink-subtle">
          <Icon name="back" size={18} />
          ทริปของฉัน
        </Link>
        <div className="flex gap-2">
          <IconLink
            href={`${base}/activity`}
            icon="bell"
            label={unread ? `ความเคลื่อนไหว ยังไม่อ่าน ${unread} รายการ` : "ความเคลื่อนไหว"}
            badge={unread}
          />
          <IconLink href="/trips/new" icon="plus" label="สร้างทริปใหม่" variant="primary" />
        </div>
      </header>

      <main className="flex flex-col gap-4 px-5 pb-6">
        <Card tone="ink" padding="lg" className="gap-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] text-on-ink-muted">{trip.destination}</span>
              <h1 className="m-0 font-display text-[26px] leading-[1.25] font-semibold">{trip.name}</h1>
              <span className="text-sm text-on-ink-soft">
                {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
              </span>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold",
                phase === "past" ? "bg-ink-divider text-on-ink-soft" : "bg-primary-highlight text-primary-ink-strong",
              )}
            >
              {formatCountdown(today, trip.startDate, trip.endDate)}
            </span>
          </div>
          <dl className="m-0 grid grid-cols-3 gap-2 border-t border-ink-divider pt-3.5">
            <Stat value={String(members.length)} label="สมาชิก" />
            <Stat value={String(places.length)} label="สถานที่" />
            <Stat value={<Money value={balances.total} />} label="ใช้ไปแล้ว" />
          </dl>
        </Card>

        <Card className="gap-3">
          <CardHeader
            title={`สมาชิก (${members.length})`}
            action={
              <Link
                href={`${base}/members`}
                className="flex min-h-11 items-center gap-1.5 rounded-chip bg-primary-soft px-3.5 text-sm font-semibold text-primary-ink no-underline hover:bg-primary-highlight hover:text-primary-ink"
              >
                <Icon name="addMember" size={16} />
                จัดการสมาชิก
              </Link>
            }
          />
          <ul className="m-0 flex list-none flex-col p-0">
            {members.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center gap-3 py-1">
                <Avatar name={m.displayName} color={m.color} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{m.displayName}</span>
                  <span className="text-[13px] text-ink-muted">{memberRoleLine(m, m.id === me.id)}</span>
                </div>
              </li>
            ))}
          </ul>
          {invite ? <CopyInviteButton path={`/join/${encodeURIComponent(invite.token)}`} /> : null}
        </Card>

        <TravelDetails trip={trip} plan={plan} places={places} spent={balances.total} />

        <ChecklistCard href={`${base}/checklist`} items={checklist} meId={me.id} />

        {/* Self-designed: the mockup has no entry for trip documents (SPEC open item). */}
        <Link href={`${base}/documents`} className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink no-underline hover:bg-surface-alt hover:text-ink">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-primary-soft text-primary">
            <Icon name="doc" size={20} />
          </span>
          <span className="flex flex-1 justify-between gap-2">
            <span className="font-semibold">เอกสารของทริป</span>
            <span className="text-[13px] text-ink-muted">{documents.length ? `${documents.length} ไฟล์` : "ยังไม่มีไฟล์"}</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-ink-muted" />
        </Link>

        <section className="flex flex-col gap-2.5" aria-labelledby="daily-plan">
          <div className="flex items-center justify-between">
            <h2 id="daily-plan" className="m-0 font-display text-[17px] font-semibold">
              แผนรายวัน
            </h2>
            <Link href={`${base}/plan`} className="flex min-h-11 items-center text-sm font-semibold no-underline">
              เปิดแผนรายวัน
            </Link>
          </div>
          <DayStrip long={days.length > 4}>
            {days.map((items, i) => {
              const day = i + 1;
              const on = day === currentDay;
              return (
                <li key={day} className={cn(days.length > 4 && "w-[calc((100%-24px)/4)] shrink-0")}>
                  <Link
                    href={`${base}/plan?day=${day}`}
                    aria-current={on && phase === "ongoing" ? "date" : undefined}
                    aria-label={`วัน ${day} ${formatWeekdayDay(tripDayDate(trip.startDate, day))} ${dayCardCaption(items, day, days.length)}`}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-2xl px-2.5 py-3 no-underline transition-colors",
                      on ? "bg-ink text-surface hover:text-surface" : "bg-surface text-ink hover:bg-surface-alt hover:text-ink",
                    )}
                  >
                    <span className={cn("text-xs", on ? "text-on-ink-muted" : "text-ink-muted")}>
                      {formatWeekdayDay(tripDayDate(trip.startDate, day))}
                    </span>
                    <span className="font-display text-[15px] font-semibold">วัน {day}</span>
                    <span className={cn("truncate text-xs", on ? "text-on-ink-soft" : "text-ink-muted")}>
                      {dayCardCaption(items, day, days.length)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </DayStrip>
        </section>
      </main>
    </>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-xs text-on-ink-muted">{label}</dt>
      <dd className="m-0 font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}

const rowIcon: Record<"plane" | "home" | "clock", { icon: IconName; className: string }> = {
  plane: { icon: "plane", className: "bg-interest-soft text-type-interest" },
  home: { icon: "home", className: "bg-primary-soft text-primary" },
  clock: { icon: "clock", className: "bg-todo-soft text-type-food" },
};

/** "รายละเอียดการเดินทาง": first Transit, first place to stay, meeting point, budget. Rows without data are left out. */
function TravelDetails({ trip, plan, places, spent }: { trip: Trip; plan: PlanItem[]; places: Place[]; spent: number }) {
  const placeById = new Map(places.map((p) => [p.id, p]));
  const flight = plan.find((i): i is TransitPlanItem => i.kind === "transit");
  const stayItem = plan.find((i) => i.kind === "place" && placeById.get(i.placeId)?.type === "stay");
  const stay = stayItem?.kind === "place" ? placeById.get(stayItem.placeId) : undefined;

  const rows: { key: keyof typeof rowIcon; label: string; text: string }[] = [];
  if (flight) {
    const route = `${flight.fromCode ?? flight.fromText} → ${flight.toCode ?? flight.toText}`;
    const arrive = `${formatDayMonth(flight.arriveAt.slice(0, 10))} ${flight.arriveAt.slice(11, 16)}`;
    rows.push({ key: "plane", label: "เดินทางไป", text: `${transitModeLabel[flight.mode]} ${route} · ถึง ${arrive}` });
  }
  if (stay) rows.push({ key: "home", label: "ที่พัก", text: [stay.name, stay.note].filter(Boolean).join(" · ") });
  if (trip.meetingPoint) rows.push({ key: "clock", label: "นัดพบ", text: trip.meetingPoint });
  if (!rows.length && trip.budget === null) return null;

  const percent = trip.budget ? Math.round((spent * 100) / trip.budget) : 0;
  return (
    <Card className="gap-1">
      <CardHeader title="รายละเอียดการเดินทาง" className="mb-1 min-h-11" />
      {rows.map((r) => (
        <div key={r.key} className="flex gap-3 border-b border-line-soft py-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", rowIcon[r.key].className)}>
            <Icon name={rowIcon[r.key].icon} size={18} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] text-ink-muted">{r.label}</span>
            <span className="font-medium">{r.text}</span>
          </div>
        </div>
      ))}
      {trip.budget !== null ? (
        <div className="flex flex-col gap-2 pt-3 pb-1">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">งบประมาณรวม</span>
            <span className="font-semibold">
              <Money value={spent} className="font-sans" /> / <Money value={trip.budget} className="font-sans" />
            </span>
          </div>
          <div role="img" aria-label={`ใช้งบไปแล้ว ${percent} เปอร์เซ็นต์`} className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className={cn("h-full rounded-full", percent > 100 ? "bg-danger" : "bg-primary")}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/** Checklist summary card: group progress (bar) + my personal progress. */
function ChecklistCard({ href, items, meId }: { href: string; items: ChecklistItem[]; meId: string }) {
  const group = items.filter((i) => i.scope === "group");
  const mine = items.filter((i) => i.scope === "personal" && i.ownerId === meId);
  const done = (list: ChecklistItem[]) => list.filter((i) => i.done).length;
  const groupPct = group.length ? Math.round((done(group) * 100) / group.length) : 0;
  const caption = [
    group.length ? `กลุ่ม ${done(group)}/${group.length}` : null,
    mine.length ? `ของฉัน ${done(mine)}/${mine.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={href} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-ink no-underline hover:bg-surface-alt hover:text-ink">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-primary-soft text-primary">
        <Icon name="checklist" size={20} />
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="flex justify-between gap-2">
          <span className="font-semibold">เช็คลิสต์</span>
          <span className="text-[13px] text-ink-muted">{caption || "ยังไม่มีรายการ"}</span>
        </span>
        <span
          role="img"
          aria-label={`เช็คลิสต์กลุ่มเสร็จ ${done(group)} จาก ${group.length}`}
          className="block h-1.5 overflow-hidden rounded-full bg-line"
        >
          <span className="block h-full bg-primary" style={{ width: `${groupPct}%` }} />
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="text-ink-muted" />
    </Link>
  );
}
