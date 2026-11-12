import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { placeTypeStyle } from "@/components/ui/colors";
import type { Place, PlanItem, TransitPlanItem, TripDocument } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDuration, transitModeLabel } from "@/lib/labels";
import { hopText } from "@/lib/plan";
import { HopButton } from "./HopButton";

interface TimelineProps {
  items: PlanItem[];
  places: ReadonlyMap<string, Place>;
  documents: ReadonlyMap<string, TripDocument>;
  /** `/trips/<id>` */
  base: string;
  /** Hop chips of these Plan Items become buttons that open the travel sheet (items the viewer may edit). */
  hopEdit?: { tripId: string; itemIds: string[] };
}

/** One day of the Planner: time column with a rail, place cards, purple Transit cards and Hop chips. */
export function Timeline({ items, places, documents, base, hopEdit }: TimelineProps) {
  const itemName = (item: PlanItem | undefined) =>
    !item ? "" : item.kind === "place" ? (places.get(item.placeId)?.name ?? "") : (item.toCode ?? item.toText);
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const time = item.kind === "transit" ? item.departAt.slice(11, 16) : (item.time ?? "—");
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex w-12 shrink-0 flex-col items-center">
              <span className="pt-3.5 font-display text-sm font-semibold tabular-nums">{time}</span>
              {item.kind === "transit" ? <span className="text-[11px] text-ink-muted">ถึง {item.arriveAt.slice(11, 16)}</span> : null}
              <span aria-hidden="true" className={cn("mt-1.5 w-0.5 flex-1", last ? "bg-transparent" : "bg-line-strong")} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col pb-1.5">
              {item.kind === "place" ? (
                <PlaceCard place={places.get(item.placeId)} note={item.note} />
              ) : (
                <TransitCard item={item} documents={documents} base={base} />
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

function PlaceCard({ place, note }: { place: Place | undefined; note: string }) {
  if (!place) return null;
  const style = placeTypeStyle[place.type];
  return (
    <article className="flex items-center gap-2.5 rounded-2xl bg-surface p-3">
      <span aria-hidden="true" className={cn("w-1.5 self-stretch rounded-full", style.bar)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={cn("text-xs font-semibold", style.text)}>
          {style.label} · {place.area ?? "ไม่ระบุย่าน"}
        </span>
        <h3 className="m-0 text-[15px] leading-[1.35] font-semibold">{place.name}</h3>
        {note ? <p className="m-0 text-[13px] text-ink-muted">{note}</p> : null}
      </div>
    </article>
  );
}

function TransitCard({ item, documents, base }: { item: TransitPlanItem; documents: ReadonlyMap<string, TripDocument>; base: string }) {
  const ref = [item.bookingRef ? `เลขที่จอง ${item.bookingRef}` : null, item.seatInfo].filter(Boolean).join(" · ");
  const docs = item.docIds.map((id) => documents.get(id)).filter((d): d is TripDocument => !!d);
  const chip = "flex min-h-9 items-center gap-1.5 rounded-[10px] border border-transit-line bg-surface px-2.5 text-[13px] font-semibold text-ink";
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-transit-line bg-transit-soft px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-type-transit text-surface">
          <Icon name="plane" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-transit-ink">
            {[transitModeLabel[item.mode], item.durationMinutes ? formatDuration(item.durationMinutes) : null].filter(Boolean).join(" · ")}
          </span>
          <h3 className="m-0 text-base font-semibold">
            {item.fromCode ?? item.fromText} → {item.toCode ?? item.toText}
          </h3>
        </div>
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
