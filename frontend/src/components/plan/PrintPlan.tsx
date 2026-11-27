import { placeTypeStyle } from "@/components/ui/colors";
import type { ReactNode } from "react";
import type { Trip } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateRange, formatDayMonth } from "@/lib/date";
import type { PrintDay, PrintItem, PrintPlaceItem, PrintTransitItem } from "@/lib/plan-print";

interface PrintPlanProps {
  trip: Pick<Trip, "name" | "destination" | "startDate" | "endDate" | "meetingPoint">;
  days: PrintDay[];
  /** Thai-formatted print date, e.g. "ศ. 27 พ.ย. 2569". */
  printedOn: string;
}

/** Read-only, money-free plan of the whole Trip for the browser print dialog (ADR 0003). No menus or edit controls, unlike Timeline. */
export function PrintPlan({ trip, days, printedOn }: PrintPlanProps) {
  return (
    <article className="flex flex-col gap-5 px-5 py-5 text-[14px] leading-snug text-ink print:gap-4 print:p-0 print:text-[11pt]">
      <header className="flex flex-col gap-1 border-b-2 border-ink pb-3">
        <h1 className="m-0 font-display text-2xl font-semibold print:text-[20pt]">{trip.name}</h1>
        <p className="m-0 text-ink-muted">
          {[trip.destination, formatDateRange(trip.startDate, trip.endDate)].filter(Boolean).join(" · ")}
        </p>
        {trip.meetingPoint ? (
          <p className="m-0">
            <span className="font-semibold">จุดนัดพบ</span> {trip.meetingPoint}
          </p>
        ) : null}
      </header>

      {days.map((d) => (
        <PrintDaySection key={d.day} day={d} />
      ))}

      <footer className="border-t border-line pt-2 text-xs text-ink-muted">พิมพ์เมื่อ {printedOn}</footer>
    </article>
  );
}

function PrintDaySection({ day }: { day: PrintDay }) {
  const heading = (
    <div className="flex flex-col gap-0.5 break-after-avoid border-b border-line-strong pb-1.5">
      <h2 className="m-0 font-display text-[17px] font-semibold break-after-avoid print:text-[13pt]">
        {["วันที่ " + day.day, formatDayMonth(day.date), day.city, day.areas].filter(Boolean).join(" · ")}
      </h2>
      {day.nightAt ? <p className="m-0 text-[13px] text-ink-muted">คืนนี้พักที่ {day.nightAt}</p> : null}
    </div>
  );
  const empty = !day.arrivals.length && !day.timed.length && !day.untimed.length;
  const first = day.arrivals.length ? (
    <Arrival a={day.arrivals[0]} />
  ) : day.timed.length ? (
    <Item item={day.timed[0]} />
  ) : null;

  return (
    <section aria-label={`วันที่ ${day.day}`} className="flex flex-col gap-2">
      {/* The heading shares a no-break box with the first item so it never ends a page alone. */}
      <div className="flex break-inside-avoid flex-col gap-2">
        {heading}
        {empty ? <p className="m-0 text-ink-muted">ยังไม่มีแผน</p> : first}
      </div>
      {day.arrivals.slice(1).map((a) => (
        <Arrival key={a.id} a={a} />
      ))}
      {(day.arrivals.length ? day.timed : day.timed.slice(1)).map((item) => (
        <Item key={item.id} item={item} />
      ))}
      {day.untimed.length ? (
        <>
          <h3 className="m-0 mt-1 text-[13px] font-semibold break-after-avoid text-ink-muted">ยังไม่ระบุเวลา</h3>
          {day.untimed.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </>
      ) : null}
    </section>
  );
}

const card = "flex break-inside-avoid gap-3 border-l-4 pl-3";

function Arrival({ a }: { a: PrintDay["arrivals"][number] }) {
  return (
    <div className={cn(card, "border-type-transit")}>
      <Time>{a.time}</Time>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          ถึง {a.to} <span className="font-normal text-ink-muted">({a.mode}จาก {a.from} · {a.departLabel})</span>
        </p>
      </div>
    </div>
  );
}

function Time({ children }: { children: ReactNode }) {
  return <span className="w-11 shrink-0 font-display font-semibold tabular-nums">{children}</span>;
}

function Item({ item }: { item: PrintItem }) {
  return item.kind === "transit" ? <Transit item={item} /> : <PlaceRow item={item} />;
}

function Hop({ text }: { text: string | null }) {
  return text ? <p className="m-0 mt-1 text-[13px] text-ink-muted">ไปจุดถัดไป: {text}</p> : null;
}

function PlaceRow({ item }: { item: PrintPlaceItem }) {
  const style = placeTypeStyle[item.type];
  const s = item.stay;
  const stayLines = s ? [s.phase, s.address, s.bookingRef ? `เลขที่จอง ${s.bookingRef}` : null].filter(Boolean) : [];
  return (
    <div className={cn(card, "[print-color-adjust:exact]", item.type === "sight" && "border-type-sight", item.type === "food" && "border-type-food", item.type === "interest" && "border-type-interest", item.type === "stay" && "border-type-stay", item.type === "transit" && "border-type-transit")}>
      <Time>{item.time ?? "—"}</Time>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          {item.mapUrl ? (
            <a href={item.mapUrl} className="text-ink underline decoration-line-strong underline-offset-2">
              {item.name}
            </a>
          ) : (
            item.name
          )}
        </p>
        <p className={cn("m-0 text-xs font-semibold", style.text)}>
          {style.label}
          {item.area ? <span className="font-normal text-ink-muted"> · {item.area}</span> : null}
        </p>
        {stayLines.map((l) => (
          <p key={l} className="m-0 text-[13px]">
            {l}
          </p>
        ))}
        {item.notes.map((n) => (
          <p key={n} className="m-0 text-[13px] text-ink-muted">
            {n}
          </p>
        ))}
        <Hop text={item.hop} />
      </div>
    </div>
  );
}

function Transit({ item }: { item: PrintTransitItem }) {
  const booking = [item.bookingRef ? `เลขที่จอง ${item.bookingRef}` : null, item.seatInfo].filter(Boolean).join(" · ");
  return (
    <div className={cn(card, "border-type-transit")}>
      <Time>{item.departTime}</Time>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">
          {item.from} → {item.to}
        </p>
        <p className="m-0 text-xs font-semibold text-type-transit">
          {[item.mode, item.duration].filter(Boolean).join(" · ")}
        </p>
        <p className="m-0 text-[13px]">
          ออก {item.departTime} · ถึง {item.arriveTime}
          {item.arriveDate ? ` (${item.arriveDate})` : ""}
        </p>
        {booking ? <p className="m-0 text-[13px]">{booking}</p> : null}
        {item.docCount ? <p className="m-0 text-[13px] text-ink-muted">ตั๋ว/เอกสาร {item.docCount} ไฟล์อยู่ในแอป — ดาวน์โหลดเก็บไว้ก่อนเดินทาง</p> : null}
        <Hop text={item.hop} />
      </div>
    </div>
  );
}
