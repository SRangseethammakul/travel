import Link from "next/link";
import type { Place } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatVisitLine, type PlaceVisit } from "@/lib/plan";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-3 last:border-b-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="m-0 text-[15px] break-words">{children}</dd>
    </div>
  );
}

/**
 * "แผนที่" (open in Google Maps) and "ในแผน" rows, shared by the read-only detail and the edit view.
 * Hotels list no per-night visits; they still list transit endpoints.
 */
export function PlacePlanInfo({ tripId, place, startDate, visits, className }: { tripId: string; place: Pick<Place, "mapUrl" | "stay">; startDate: string; visits: PlaceVisit[]; className?: string }) {
  const showPlan = !place.stay || visits.length > 0;
  if (!place.mapUrl && !showPlan) return null;
  return (
    <dl className={cn("m-0", className)}>
      {place.mapUrl ? (
        <InfoRow label="แผนที่">
          <a href={place.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary">
            เปิดใน Google Maps
          </a>
        </InfoRow>
      ) : null}
      {showPlan ? (
        <InfoRow label="ในแผน">
          {visits.length ? (
            <span className="flex flex-col">
              {visits.map((v, i) => (
                <Link key={`${v.day}-${v.time}-${i}`} href={`/trips/${encodeURIComponent(tripId)}/plan?day=${v.day}`} className="flex min-h-11 items-center font-semibold text-primary">
                  {formatVisitLine(v, startDate)}
                </Link>
              ))}
            </span>
          ) : (
            <span className="text-ink-muted">ยังไม่จัดวัน</span>
          )}
        </InfoRow>
      ) : null}
    </dl>
  );
}
