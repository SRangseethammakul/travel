import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { placeTypeStyle } from "@/components/ui/colors";
import type { Member, Place } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/date";
import type { PlaceVisit } from "@/lib/plan";
import { canAddExpense, canAddPlacePhoto } from "@/lib/permissions";
import { stayNights } from "@/lib/place-form";
import { PlacePhotos } from "./PlacePhotos";
import { PlacePlanInfo } from "./PlacePlanInfo";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-3 last:border-b-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="m-0 text-[15px] break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Read-only Place, shown to every member (tapping a place never opens the form). Shows the note, which the list only previews; editors get an "แก้ไข" button to the edit page. */
export function PlaceDetail({ tripId, place, me, tagNames, linkedExpense, startDate, visits, editHref }: { tripId: string; place: Place; me: Pick<Member, "id" | "role">; tagNames: string[]; linkedExpense?: { id: string; amount: number } | null; startDate: string; visits: PlaceVisit[]; editHref?: string }) {
  const style = placeTypeStyle[place.type];
  const stay = place.stay;
  return (
    <main className="flex flex-col gap-3 px-5 pt-1 pb-8">
      <section className="flex items-stretch gap-3 rounded-tile bg-surface p-3.5">
        <span aria-hidden="true" className={cn("w-1.5 shrink-0 rounded-full", style.bar)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("text-xs font-semibold", style.text)}>{style.label}</span>
          <h2 className="m-0 font-display text-lg font-semibold">{place.name}</h2>
          <span className="text-[13px] text-ink-muted">
            {place.city} · {place.area ?? "ไม่ระบุย่าน"}
          </span>
        </div>
        {editHref ? (
          <ButtonLink href={editHref} variant="secondary" size="sm" className="ml-auto self-start">
            แก้ไข
          </ButtonLink>
        ) : null}
      </section>
      {place.photos.length || canAddPlacePhoto(me) ? (
        <PlacePhotos tripId={tripId} placeId={place.id} placeName={place.name} photos={place.photos} me={me} className="rounded-tile bg-surface p-3.5" />
      ) : null}
      <PlacePlanInfo tripId={tripId} place={place} startDate={startDate} visits={visits} className="rounded-tile bg-surface px-3.5" />
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
            {!linkedExpense && !stay.expenseId && stay.price && canAddExpense(me) ? (
              <Row label="ค่าใช้จ่าย">
                <span className="text-ink-muted">ยังไม่ได้จดเป็นค่าใช้จ่าย</span>
                <Link href={`/trips/${encodeURIComponent(tripId)}/expenses/new?stay=${encodeURIComponent(place.id)}`} className="flex min-h-11 items-center font-semibold text-primary">
                  จดเป็นค่าใช้จ่าย
                </Link>
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
        {tagNames.length ? <Row label="Tag">{tagNames.map((t) => `#${t}`).join(" ")}</Row> : null}
        <Row label="โน้ต">{place.note || <span className="text-ink-muted">ไม่มีโน้ต</span>}</Row>
      </dl>
    </main>
  );
}
