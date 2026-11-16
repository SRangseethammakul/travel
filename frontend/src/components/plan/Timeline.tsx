import Link from "next/link";
import { Icon, transitModeIcon } from "@/components/ui/Icon";
import { MapButton } from "@/components/ui/MapButton";
import { placeTypeStyle } from "@/components/ui/colors";
import type { Place, PlanItem, TransitPlanItem, TripDocument } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDuration, transitModeLabel } from "@/lib/labels";
import { formatDayMonth, formatWeekdayDay } from "@/lib/date";
import { stayNights, stayPhase } from "@/lib/place-form";
import { Money } from "@/components/ui/Money";
import { arrivesLaterDay, hopText } from "@/lib/plan";
import { HopButton } from "./HopButton";
import { PlaceMenu, type PlaceMenuProps } from "./PlaceMenu";
import { TransitMenu, type TransitMenuProps } from "./TransitMenu";

interface TimelineProps {
  items: PlanItem[];
  places: ReadonlyMap<string, Place>;
  documents: ReadonlyMap<string, TripDocument>;
  /** `/trips/<id>` */
  base: string;
  /** Hop chips of these Plan Items become buttons that open the travel sheet (items the viewer may edit). */
  hopEdit?: { tripId: string; itemIds: string[]; /** Day chips of the edit sheet. */ days: { day: number; sub: string }[]; /** Days each Place is already on. */ taken: Record<string, number[]> };
  /** Expenses linked to Transit cards, to ask about them when a Transit is deleted. */
  expenses?: ReadonlyMap<string, { amount: number; canDelete: boolean }>;
  /** Overnight Transits landing on this day, shown first as read-only arrival rows. */
  arrivals?: { item: TransitPlanItem; departDay: number }[];
  /** Calendar date of this day (ISO), to tell a hotel's check-in / night / check-out apart. */
  date?: string;
}

/** One day of the Planner: time column with a rail, place cards, purple Transit cards and Hop chips. */
export function Timeline({ items, places, documents, base, hopEdit, expenses, arrivals = [], date }: TimelineProps) {
  const itemName = (item: PlanItem | undefined) =>
    !item ? "" : item.kind === "place" ? (places.get(item.placeId)?.name ?? "") : (item.toCode ?? item.toText);
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {arrivals.map(({ item, departDay }, i) => (
        <li key={`arrive-${item.id}`} className="flex gap-3">
          <div className="flex w-12 shrink-0 flex-col items-center">
            <span className="pt-3.5 font-display text-sm font-semibold tabular-nums">{item.arriveAt.slice(11, 16)}</span>
            <span aria-hidden="true" className={cn("mt-1.5 w-0.5 flex-1", i === arrivals.length - 1 && !items.length ? "bg-transparent" : "bg-line-strong")} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col pb-1.5">
            <article className="flex items-center gap-2.5 rounded-2xl border border-dashed border-transit-line bg-transit-soft/60 px-3.5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-type-transit/80 text-surface">
                <Icon name={transitModeIcon[item.mode]} size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="m-0 text-base font-semibold">ถึง {item.toCode ?? item.toText}</h3>
                <span className="text-xs text-transit-ink">
                  {transitModeLabel[item.mode]}จาก {item.fromCode ?? item.fromText} · ออกวัน {departDay} {item.departAt.slice(11, 16)}
                </span>
              </div>
            </article>
          </div>
        </li>
      ))}
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const time = item.kind === "transit" ? item.departAt.slice(11, 16) : (item.time ?? "—");
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex w-12 shrink-0 flex-col items-center">
              <span className="pt-3.5 font-display text-sm font-semibold tabular-nums">{time}</span>
              {item.kind === "transit" ? <span className="text-[11px] text-ink-muted">ถึง {item.arriveAt.slice(11, 16)}</span> : null}
              {item.kind === "transit" && arrivesLaterDay(item) ? (
                <span className="text-[11px] font-semibold whitespace-nowrap text-transit-ink">{formatWeekdayDay(item.arriveAt.slice(0, 10))}</span>
              ) : null}
              <span aria-hidden="true" className={cn("mt-1.5 w-0.5 flex-1", last ? "bg-transparent" : "bg-line-strong")} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col pb-1.5">
              {item.kind === "place" ? (
                <PlaceCard
                  place={places.get(item.placeId)}
                  note={item.note}
                  date={date}
                  href={`${base}/places/${encodeURIComponent(item.placeId)}`}
                  menu={
                    hopEdit?.itemIds.includes(item.id)
                      ? { tripId: hopEdit.tripId, itemId: item.id, day: item.day, time: item.time, days: hopEdit.days, taken: hopEdit.taken[item.placeId] ?? [] }
                      : undefined
                  }
                />
              ) : (
                <TransitCard
                  item={item}
                  documents={documents}
                  base={base}
                  menu={
                    hopEdit?.itemIds.includes(item.id)
                      ? {
                          tripId: hopEdit.tripId,
                          itemId: item.id,
                          name: `${item.fromCode ?? item.fromText} → ${item.toCode ?? item.toText}`,
                          ...(item.expenseId && expenses?.get(item.expenseId) ? { expense: { id: item.expenseId, ...expenses.get(item.expenseId)! } } : {}),
                        }
                      : undefined
                  }
                />
              )}
              {!last && hopEdit?.itemIds.includes(item.id) ? (
                <HopButton tripId={hopEdit.tripId} itemId={item.id} hop={item.travelToNext} title={`${itemName(item)} → ${itemName(items[i + 1])}`} />
              ) : !last && item.travelToNext ? (
                <span className="mt-1.5 mb-0.5 inline-flex min-h-9 items-center gap-1.5 self-start rounded-[10px] bg-interest-soft px-2.5 text-xs font-semibold text-interest-ink">
                  <Icon name="route" size={14} />
                  <span className="sr-only">การเดินทางไปรายการถัดไป: </span>
                  {hopText(item.travelToNext)}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const stayPhaseText = { in: "เช็คอิน · นอนที่นี่คืนนี้", night: "นอนที่นี่คืนนี้", out: "เช็คเอาท์" } as const;

function PlaceCard({ place, note, date, href, menu }: { place: Place | undefined; note: string; date?: string; href: string; menu?: Omit<PlaceMenuProps, "name" | "note" | "isStay"> }) {
  if (!place) return null;
  const style = placeTypeStyle[place.type];
  const stay = place.stay;
  const phase = stay && date ? stayPhase(stay, date) : null;
  const sub = phase ? stayPhaseText[phase] : `${style.label} · ${place.area ?? "ไม่ระบุย่าน"}`;
  return (
    <article className="relative flex items-center gap-2.5 rounded-2xl bg-surface p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <span aria-hidden="true" className={cn("w-1.5 self-stretch rounded-full", style.bar)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={cn("text-xs font-semibold", style.text)}>{sub}</span>
        <h3 className="m-0 text-[15px] leading-[1.35] font-semibold">
          <Link href={href} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:text-ink focus-visible:outline-none">
            {place.name}
          </Link>
        </h3>
        {stay ? (
          <span className="text-xs text-ink-muted">
            {formatDayMonth(stay.checkIn)} – {formatDayMonth(stay.checkOut)} · {stayNights(stay)} คืน
            {stay.price ? (
              <>
                {" · "}
                <Money value={stay.price} className="font-sans" />
              </>
            ) : null}
          </span>
        ) : null}
        {note ? <p className="m-0 text-[13px] text-ink-muted">{note}</p> : null}
        {place.note ? <p className="m-0 line-clamp-2 text-[13px] text-ink-muted">โน้ต: {place.note}</p> : null}
      </div>
      {place.mapUrl ? <MapButton href={place.mapUrl} name={place.name} className="-my-2" /> : null}
      {menu ? <PlaceMenu {...menu} name={place.name} note={note} isStay={!!stay} /> : null}
      <Icon name="chevronRight" size={16} className="shrink-0 text-ink-subtle" />
    </article>
  );
}

function TransitCard({ item, documents, base, menu }: { item: TransitPlanItem; documents: ReadonlyMap<string, TripDocument>; base: string; menu?: TransitMenuProps }) {
  const ref = [item.bookingRef ? `เลขที่จอง ${item.bookingRef}` : null, item.seatInfo].filter(Boolean).join(" · ");
  const docs = item.docIds.map((id) => documents.get(id)).filter((d): d is TripDocument => !!d);
  const chip = "flex min-h-9 items-center gap-1.5 rounded-[10px] border border-transit-line bg-surface px-2.5 text-[13px] font-semibold text-ink";
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-transit-line bg-transit-soft px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-type-transit text-surface">
          <Icon name={transitModeIcon[item.mode]} size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-transit-ink">
            {[transitModeLabel[item.mode], item.durationMinutes ? formatDuration(item.durationMinutes) : null].filter(Boolean).join(" · ")}
          </span>
          <h3 className="m-0 text-base font-semibold">
            {item.fromCode ?? item.fromText} → {item.toCode ?? item.toText}
          </h3>
        </div>
        {menu ? <TransitMenu {...menu} /> : null}
      </div>
      {ref ? <span className="text-xs text-transit-ink-strong">{ref}</span> : null}
      {docs.length || item.expenseId ? (
        <div className="flex flex-wrap gap-2">
          {/* Documents open through signed URLs once a backend exists; for now the name is shown only. */}
          {docs.map((d) => (
            <span key={d.id} className={chip}>
              <Icon name="doc" size={14} />
              {d.name}
            </span>
          ))}
          {item.expenseId ? (
            <Link href={`${base}/expenses/${encodeURIComponent(item.expenseId)}`} className={cn(chip, "min-h-11 no-underline hover:bg-surface-alt hover:text-ink")}>
              ฿ ค่าใช้จ่าย
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
