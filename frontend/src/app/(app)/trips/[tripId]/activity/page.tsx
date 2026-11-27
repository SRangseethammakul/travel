import type { Metadata } from "next";
import Link from "next/link";
import { ActivityLink, MarkAllReadButton, NotificationSettingsButton } from "@/components/activity/ActivityControls";
import { Avatar } from "@/components/ui/Avatar";
import { IconLink } from "@/components/ui/IconButton";
import {
  getActivity,
  getCurrentUserId,
  getExpenses,
  getMembers,
  getPlanItems,
  getSettlements,
  planItemDay,
  requireTripMember,
} from "@/lib/api";
import type { Activity, ActivityType } from "@/lib/api/types";
import { ACTIVITY_FILTERS, groupActivityByDay, isUnread, parseActivityFilter, personalizeText } from "@/lib/activity-view";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/date";
import { formatMoney } from "@/lib/money/format";

export const metadata: Metadata = { title: "ความเคลื่อนไหว · Plan Trip" };

const TAG: Record<ActivityType, { label: string; className: string }> = {
  expense: { label: "฿", className: "bg-todo-soft text-todo" },
  settlement: { label: "โอน", className: "bg-primary-soft text-primary-ink" },
  plan: { label: "แผน", className: "bg-interest-soft text-interest-ink" },
  member: { label: "ใหม่", className: "bg-transit-soft text-transit-ink" },
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ActivityPage({ params, searchParams }: PageProps<"/trips/[tripId]/activity">) {
  const { tripId } = await params;
  const filter = parseActivityFilter(first((await searchParams).type));
  const { trip, me } = await requireTripMember(tripId);
  const [userId, activity, members, expenses, settlements, plan] = await Promise.all([
    getCurrentUserId(),
    getActivity(tripId),
    getMembers(tripId),
    getExpenses(tripId),
    getSettlements(tripId),
    getPlanItems(tripId),
  ]);
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const now = new Date();
  const memberById = new Map(members.map((m) => [m.id, m]));
  const unreadTotal = activity.filter((a) => isUnread(a, userId, me.id)).length;
  const shown = filter === "all" ? activity : activity.filter((a) => a.type === filter);

  /** Where a row leads, its text for this viewer, and an inline action when something waits on me. */
  const describe = (a: Activity) => {
    let href = base;
    let text = personalizeText(a.text, me.displayName);
    let action: string | null = null;
    if (a.type === "expense") {
      const e = a.refId ? expenses.find((x) => x.id === a.refId) : undefined;
      href = e ? `${base}/expenses/${encodeURIComponent(e.id)}` : `${base}/expenses`;
      const mine = e?.shares.find((s) => s.memberId === me.id);
      if (e && mine && mine.amount > 0 && a.actorId !== me.id && a.text.startsWith("เพิ่ม")) text += ` · ส่วนของคุณ ${formatMoney(mine.amount)}`;
    } else if (a.type === "settlement") {
      const s = a.refId ? settlements.find((x) => x.id === a.refId) : undefined;
      href = s ? `${base}/summary/settle?from=${encodeURIComponent(s.fromId)}&to=${encodeURIComponent(s.toId)}` : `${base}/summary`;
      if (s && s.status === "sent" && s.toId === me.id) action = "ตรวจและยืนยัน";
    } else if (a.type === "plan") {
      const item = a.refId ? plan.find((x) => x.id === a.refId) : undefined;
      href = item ? `${base}/plan?day=${planItemDay(item, trip)}` : `${base}/places`;
    } else {
      href = `${base}/members`;
    }
    return { href, text, action };
  };

  const groups = groupActivityByDay(shown, now);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex flex-col gap-2.5 px-5 pt-4 pb-2.5">
        <div className="-ml-2 flex items-center gap-2">
          <IconLink href={base} icon="back" label="ย้อนกลับ" variant="ghost" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="m-0 font-display text-lg font-semibold">ความเคลื่อนไหว</h1>
            <span className="truncate text-xs text-ink-muted">
              {trip.name} · ยังไม่อ่าน {unreadTotal}
            </span>
          </div>
          <NotificationSettingsButton />
        </div>
        <nav aria-label="กรองตามประเภท" className="-mx-5 overflow-x-auto px-5 py-1">
          <ul className="m-0 flex w-max list-none gap-1.5 p-0">
            {ACTIVITY_FILTERS.map((f) => {
              const on = f.value === filter;
              return (
                <li key={f.value}>
                  <Link
                    href={f.value === "all" ? `${base}/activity` : `${base}/activity?type=${f.value}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={cn(
                      "relative flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap no-underline transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
                      on ? "border-ink bg-ink text-surface hover:text-surface" : "border-line-strong bg-surface text-ink hover:border-ink-muted hover:text-ink",
                    )}
                  >
                    {f.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-5 pt-1 pb-6">
        <div className="-mb-2 flex justify-end">
          <MarkAllReadButton tripId={tripId} disabled={unreadTotal === 0} />
        </div>

        {groups.length ? (
          groups.map((g) => (
            <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-semibold text-ink-muted">{g.title}</h2>
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
                {g.items.map((a) => {
                  const actor = memberById.get(a.actorId);
                  const name = actor ? (actor.id === me.id ? "คุณ" : actor.displayName) : "สมาชิกเดิม";
                  const unread = isUnread(a, userId, me.id);
                  const { href, text, action } = describe(a);
                  const tag = TAG[a.type];
                  return (
                    <li key={a.id} className="border-b border-line-soft last:border-b-0">
                      <ActivityLink
                        tripId={tripId}
                        id={a.id}
                        unread={unread}
                        href={href}
                        className={cn(
                          "flex gap-3 p-3.5 text-ink no-underline transition-colors duration-150 hover:text-ink",
                          unread ? "bg-primary-wash hover:bg-primary-soft" : "bg-surface hover:bg-surface-alt",
                        )}
                      >
                        <span className="relative size-10 shrink-0">
                          <Avatar name={actor?.displayName ?? "?"} color={actor?.color ?? "gray"} size="lg" />
                          <span aria-hidden="true" className={cn("absolute -right-1 -bottom-1 rounded-full border-2 border-surface px-[5px] py-px text-[10px] font-bold", tag.className)}>
                            {tag.label}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="text-sm leading-normal">
                            <strong className="font-semibold">{name}</strong> {text}
                          </span>
                          <span className="text-xs text-ink-muted">{formatTimestamp(a.createdAt, now)}</span>
                          {action ? (
                            <span className="mt-0.5 flex min-h-8 items-center self-start rounded-[10px] bg-primary px-3 text-[13px] font-semibold text-surface">{action}</span>
                          ) : null}
                        </span>
                        {unread ? <span role="img" aria-label="ยังไม่อ่าน" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" /> : null}
                      </ActivityLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <p className="m-0 rounded-card bg-surface px-4 py-6 text-center text-sm text-ink-muted">
            {filter === "all" ? "ยังไม่มีความเคลื่อนไหวในทริปนี้" : "ยังไม่มีความเคลื่อนไหวประเภทนี้"}
          </p>
        )}
      </main>
    </div>
  );
}
