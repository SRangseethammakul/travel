import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { formatDayMonth } from "@/lib/date";
import { stayNights } from "@/lib/place-form";
import type { LodgingNight } from "@/lib/plan";

interface Group {
  from: number;
  to: number;
  place: LodgingNight["place"];
}

/** Night 1..N → hotel, with consecutive nights at the same place merged ("คืนที่ 1–3"). */
function groupNights(nights: readonly LodgingNight[]): Group[] {
  const out: Group[] = [];
  for (const n of nights) {
    const last = out[out.length - 1];
    if (last && last.place?.id === n.place?.id && last.to === n.night - 1) last.to = n.night;
    else out.push({ from: n.night, to: n.night, place: n.place });
  }
  return out;
}

/** "ที่พักแต่ละคืน" at the top of the Plan tab: where we sleep, without tapping day by day. */
export function LodgingNights({ nights, base, day }: { nights: readonly LodgingNight[]; base: string; day: number }) {
  const groups = groupNights(nights);
  const allEmpty = groups.every((g) => !g.place);
  return (
    <section aria-labelledby="nights-title" className="flex flex-col gap-1 rounded-tile bg-surface px-3.5 py-3">
      <h2 id="nights-title" className="m-0 text-sm font-semibold">
        ที่พักแต่ละคืน
      </h2>
      {allEmpty ? (
        <p className="m-0 text-[13px] text-ink-muted">ยังไม่ได้ใส่ที่พัก เพิ่มสถานที่ประเภทที่พักพร้อมวันเช็คอิน–เช็คเอาท์ แล้วจะขึ้นที่นี่</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {groups.map((g) => {
            const label = g.from === g.to ? `คืนที่ ${g.from}` : `คืนที่ ${g.from}–${g.to}`;
            const current = day >= g.from && day <= g.to;
            return (
              <li key={g.from} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
                <span className="w-[72px] shrink-0 text-xs font-semibold text-ink-muted">{label}</span>
                {g.place ? (
                  <Link
                    href={`${base}/places/${encodeURIComponent(g.place.id)}`}
                    aria-current={current ? "true" : undefined}
                    className="-my-1 flex min-h-11 min-w-0 flex-1 flex-col justify-center text-ink no-underline hover:text-ink"
                  >
                    <span className="truncate text-[15px] font-semibold">{g.place.name}</span>
                    {g.place.stay ? (
                      <span className="text-xs text-ink-muted">
                        {formatDayMonth(g.place.stay.checkIn)} – {formatDayMonth(g.place.stay.checkOut)} · {stayNights(g.place.stay)} คืน
                        {g.place.stay.price ? (
                          <>
                            {" · "}
                            <Money value={g.place.stay.price} className="font-sans" />
                          </>
                        ) : null}
                        {g.place.stay.bookingRef ? ` · จอง ${g.place.stay.bookingRef}` : ""}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="flex-1 text-[13px] text-todo">ยังไม่มีที่พัก</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href={`${base}/places/new?type=stay&day=${day}`}
        className="-mb-1 flex min-h-11 items-center self-start text-[13px] font-semibold text-primary no-underline hover:text-primary-hover"
      >
        + เพิ่มที่พัก
      </Link>
    </section>
  );
}

/** Gentle heads-up when stays and transit don't line up (see stayTransitWarnings). */
export function StayWarnings({ warnings }: { warnings: readonly string[] }) {
  if (!warnings.length) return null;
  return (
    <section aria-label="ข้อควรเช็ค" className="flex flex-col gap-1 rounded-tile bg-todo-soft px-3.5 py-3">
      <h2 className="m-0 text-sm font-semibold text-todo">ลองเช็คอีกที</h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {warnings.map((w) => (
          <li key={w} className="text-[13px] text-ink">
            {w}
          </li>
        ))}
      </ul>
    </section>
  );
}
