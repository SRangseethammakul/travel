import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { placeTypeStyle } from "@/components/ui/colors";
import type { Member, Place } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/date";
import { canAddPlacePhoto } from "@/lib/permissions";
import { stayNights } from "@/lib/place-form";
import { PlacePhotos } from "./PlacePhotos";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-3 last:border-b-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="m-0 text-[15px] break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Read-only Place (viewers, and editors on places they did not add). Shows the note, which the list only previews. */
export function PlaceDetail({ tripId, place, me, tagNames, linkedExpense }: { tripId: string; place: Place; me: Pick<Member, "id" | "role">; tagNames: string[]; linkedExpense?: { id: string; amount: number } | null }) {
  const style = placeTypeStyle[place.type];
  const stay = place.stay;
  return (
    <main className="flex flex-col gap-3 px-5 pt-1 pb-8">
      <section className="flex items-stretch gap-3 rounded-tile bg-surface p-3.5">
        <span aria-hidden="true" className={cn("w-1.5 shrink-0 rounded-full", style.bar)} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("text-xs font-semibold", style.text)}>{style.label}</span>
          <h2 className="m-0 font-display text-lg font-semibold">{place.name}</h2>
          <span className="text-[13px] text-ink-muted">
            {place.city} · {place.area ?? "ไม่ระบุย่าน"}
          </span>
        </div>
      </section>
      {place.photos.length || canAddPlacePhoto(me) ? (
        <PlacePhotos tripId={tripId} placeId={place.id} placeName={place.name} photos={place.photos} me={me} className="rounded-tile bg-surface p-3.5" />
      ) : null}
      <dl className="m-0 rounded-tile bg-surface px-3.5">
        {stay ? (
          <>
            <Row label="เช็คอิน – เช็คเอาท์">
              {formatDayMonth(stay.checkIn)} – {formatDayMonth(stay.checkOut)} ({stayNights(stay)} คืน)
            </Row>
            {stay.price ? (
              <Row label="ราคารวม">
                <Money value={stay.price} />
              </Row>
            ) : null}
            {linkedExpense ? (
              <Row label="ค่าใช้จ่าย">
                <span className="font-semibold">บันทึกเป็นค่าใช้จ่ายแล้ว <Money value={linkedExpense.amount} /></span>
                <Link href={`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(linkedExpense.id)}`} className="flex min-h-11 items-center font-semibold text-primary">
                  ดูรายการค่าใช้จ่าย
                </Link>
              </Row>
            ) : null}
            {stay.bookingRef ? <Row label="เลขที่จอง">{stay.bookingRef}</Row> : null}
            {stay.address ? <Row label="ที่อยู่">{stay.address}</Row> : null}
          </>
        ) : null}
        {place.mapUrl ? (
          <Row label="แผนที่">
            <a href={place.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary">
              เปิดใน Google Maps
            </a>
          </Row>
        ) : null}
        {tagNames.length ? <Row label="Tag">{tagNames.map((t) => `#${t}`).join(" ")}</Row> : null}
        <Row label="โน้ต">{place.note || <span className="text-ink-muted">ไม่มีโน้ต</span>}</Row>
      </dl>
    </main>
  );
}
