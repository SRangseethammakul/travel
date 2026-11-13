import Link from "next/link";
import { Timeline } from "@/components/plan/Timeline";
import { TabPageHeader } from "@/components/trip/TabPageHeader";
import { DayStrip } from "@/components/trip/DayStrip";
import { Icon } from "@/components/ui/Icon";
import { buttonClasses } from "@/components/ui/Button";
import { placeTypeStyle } from "@/components/ui/colors";
import { getDocuments, getPlaces, getPlanItems, requireTripMember } from "@/lib/api";
import { cn } from "@/lib/cn";
import { canEditPlanEntry } from "@/lib/permissions";
import { formatLongDayMonth, formatWeekdayDay, todayISO, tripDayDate } from "@/lib/date";
import { arrivalsOnDay, dayAreasLabel, itemDay, itemsByDay, legCity, resolveDay, unscheduledPlaces } from "@/lib/plan";

export default async function PlannerPage({ params, searchParams }: PageProps<"/trips/[tripId]/plan">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const [plan, places, documents] = await Promise.all([getPlanItems(tripId), getPlaces(tripId), getDocuments(tripId)]);

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const days = itemsByDay(plan, trip);
  const day = resolveDay(sp.day, trip, todayISO());
  const dayItems = days[day - 1];
  const arrivals = arrivalsOnDay(plan, trip, day).map((item) => ({ item, departDay: itemDay(item, trip) }));
  const placeById = new Map(places.map((p) => [p.id, p]));
  const city = trip.legs?.length ? legCity(trip.legs, day) : null;
  // Multi-city trips list the day's city first (SPEC: City Legs).
  const pool = unscheduledPlaces(places, plan, trip).sort((a, b) => Number(b.city === city) - Number(a.city === city));
  const date = tripDayDate(trip.startDate, day);
  const areas = dayAreasLabel(dayItems, placeById, city);
  const dashed = buttonClasses({ variant: "dashed", className: "rounded-2xl text-sm" });

  return (
    <>
      <TabPageHeader caption={trip.name} title="แผนรายวัน">
        <nav aria-label="เลือกวัน">
          <DayStrip long={days.length > 4}>
            {days.map((_, i) => {
              const d = i + 1;
              const on = d === day;
              return (
                <li key={d} className={cn(days.length > 4 && "w-[calc((100%-24px)/4)] shrink-0")}>
                  <Link
                    href={`${base}/plan?day=${d}`}
                    scroll={false}
                    replace
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-2.5 no-underline transition-colors duration-150",
                      on ? "border-ink bg-ink text-surface hover:text-surface" : "border-line bg-surface text-ink hover:border-ink-muted hover:text-ink",
                    )}
                  >
                    <span className="text-xs opacity-85">{formatWeekdayDay(tripDayDate(trip.startDate, d))}</span>
                    <span className="font-display text-[15px] font-semibold">วัน {d}</span>
                  </Link>
                </li>
              );
            })}
          </DayStrip>
        </nav>
      </TabPageHeader>

      <main className="flex flex-col gap-3.5 px-5 pt-1 pb-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="m-0 font-display text-[17px] font-semibold">
            วันที่ {day} · {formatLongDayMonth(date)}
          </h2>
          {areas ? <span className="text-right text-[13px] text-ink-muted">{areas}</span> : null}
        </div>

        {dayItems.length || arrivals.length ? (
          <Timeline
            items={dayItems}
            places={placeById}
            documents={new Map(documents.map((d) => [d.id, d]))}
            base={base}
            hopEdit={{ tripId, itemIds: dayItems.filter((i) => canEditPlanEntry(me, i)).map((i) => i.id) }}
            arrivals={arrivals}
          />
        ) : (
          <p className="m-0 rounded-2xl bg-surface px-4 py-5 text-center text-sm text-ink-muted">ยังไม่มีแผนของวันนี้ เพิ่มสถานที่หรือเที่ยวบินได้ด้านล่าง</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link href={`${base}/plan/add?day=${day}`} className={dashed}>
            <Icon name="plus" size={16} />
            สถานที่
          </Link>
          <Link href={`${base}/plan/transit/new?day=${day}`} className={dashed}>
            <Icon name="plus" size={16} />
            เที่ยวบิน/ตั๋ว
          </Link>
        </div>

        <section aria-labelledby="pool-title" className="flex flex-col gap-2.5 rounded-tile bg-surface p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="pool-title" className="m-0 text-sm font-semibold">
              ยังไม่จัดวัน
            </h2>
            {pool.length ? <span className="text-xs text-ink-muted">กดเพื่อเพิ่มเข้าวัน {day}</span> : null}
          </div>
          {pool.length ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {pool.map((p) => {
                const style = placeTypeStyle[p.type];
                return (
                  <li key={p.id}>
                    <Link
                      href={`${base}/plan/add?day=${day}&place=${encodeURIComponent(p.id)}`}
                      aria-label={`เพิ่ม ${p.name} เข้าวัน ${day}`}
                      className={cn(
                        "relative flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold no-underline",
                        "before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[''] hover:border-ink-muted",
                        style.tint,
                        style.text,
                      )}
                    >
                      <Icon name="plus" size={14} />
                      {p.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="text-[13px] text-ink-muted">จัดครบทุกที่แล้ว</span>
          )}
        </section>
      </main>
    </>
  );
}
