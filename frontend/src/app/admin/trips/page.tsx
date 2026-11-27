import Link from "next/link";
import type { Metadata } from "next";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { EmptyResult } from "@/components/admin/EmptyResult";
import { Pager } from "@/components/admin/Pager";
import { FilterPill, TripStatusBadge } from "@/components/admin/Pills";
import { SearchBox } from "@/components/admin/SearchBox";
import { Avatar } from "@/components/ui/Avatar";
import { Money } from "@/components/ui/Money";
import { solidBg } from "@/components/ui/colors";
import { getAdminTrip, getAdminTrips } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { roleLabel } from "@/lib/labels";
import { formatDateRange, formatTimestamp } from "@/lib/date";
import { adminHref, first, int, ownersLabel, parsePage, pick, tripStatusLabel } from "@/utils/admin";

export const metadata: Metadata = { title: "ทริป · ผู้ดูแลระบบ" };

const STATUSES = ["all", "upcoming", "ongoing", "past"] as const;
const COLS = "grid grid-cols-[2.2fr_1.2fr_1fr_0.6fr_1.1fr_1fr] items-center gap-3 px-5";

export default async function AdminTripsPage({ searchParams }: PageProps<"/admin/trips">) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() || undefined;
  const status = pick(sp.status, STATUSES, "all");
  const page = parsePage(sp.page);
  const data = await getAdminTrips({ q, status: status === "all" ? undefined : status, page });
  const selectedId = first(sp.selected) || data.items[0]?.id;
  const detail = selectedId ? await getAdminTrip(selectedId) : null;

  const url = (over: Record<string, string | number | undefined | null> = {}) =>
    adminHref("/admin/trips", { q, status: status === "all" ? undefined : status, page: page > 1 ? page : undefined, selected: first(sp.selected), ...over });

  return (
    <>
      <AdminTopBar title="ทริป" count={`${int(data.total)} ทริป`}>
        <SearchBox action="/admin/trips" placeholder="ค้นหาชื่อทริป ปลายทาง หรือผู้จัดทริป…" value={q} keep={{ status: status === "all" ? undefined : status }} />
      </AdminTopBar>

      <div className="grid flex-1 grid-cols-[1fr_400px]">
        <main className="flex min-w-0 flex-col gap-4 py-6 pr-6 pl-8">
          <div className="flex gap-2" role="group" aria-label="กรองตามสถานะ">
            {STATUSES.map((s) => (
              <FilterPill key={s} href={url({ status: s === "all" ? undefined : s, page: undefined })} on={s === status}>
                {s === "all" ? "ทั้งหมด" : tripStatusLabel[s]}
              </FilterPill>
            ))}
          </div>

          <section role="table" aria-label="ทริป" className="overflow-hidden rounded-tile bg-surface">
            <div role="row" className={cn(COLS, "h-11 border-b border-line bg-surface-alt text-xs font-semibold text-ink-muted")}>
              <span role="columnheader">ทริป</span>
              <span role="columnheader">วันที่</span>
              <span role="columnheader">ผู้จัดทริป</span>
              <span role="columnheader" className="text-right">
                คน
              </span>
              <span role="columnheader" className="text-right">
                ใช้ไป
              </span>
              <span role="columnheader">สถานะ</span>
            </div>
            {data.items.length === 0 ? (
              <EmptyResult title={q ? `ไม่พบทริปที่ตรงกับ “${q}”` : "ไม่พบทริป"} hint="ลองค้นด้วยชื่อปลายทางหรือผู้จัดทริป หรือเอาตัวกรองออก" clearHref="/admin/trips" />
            ) : (
              <>
                {data.items.map((t) => {
                  const on = t.id === detail?.trip.id;
                  return (
                    <div
                      key={t.id}
                      role="row"
                      aria-selected={on}
                      className={cn(COLS, "relative min-h-[60px] border-b border-line-soft text-sm", on ? "bg-primary-wash shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-surface-alt")}
                    >
                      <span role="cell" className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className={cn("h-8 w-2 flex-none rounded", solidBg[t.cover])} />
                        <span className="flex min-w-0 flex-col">
                          <Link href={url({ selected: t.id })} aria-current={on ? "true" : undefined} className="truncate font-semibold text-ink no-underline after:absolute after:inset-0 hover:text-ink">
                            {t.name}
                          </Link>
                          <span className="truncate text-xs text-ink-muted">{t.destination}</span>
                        </span>
                      </span>
                      <span role="cell" className="text-[13px] text-ink-subtle">
                        {formatDateRange(t.startDate, t.endDate)}
                      </span>
                      <span role="cell" className="truncate text-ink-subtle">
                        {ownersLabel(t.owners)}
                      </span>
                      <span role="cell" className="text-right font-display font-semibold">
                        {t.memberCount}
                      </span>
                      <span role="cell" className="text-right font-semibold">
                        {t.spent > 0 ? <Money value={t.spent} /> : "—"}
                      </span>
                      <span role="cell">
                        <TripStatusBadge status={t.status} />
                      </span>
                    </div>
                  );
                })}
                <Pager page={data.page} pageSize={data.pageSize} total={data.total} shown={data.items.length} href={(p) => url({ page: p > 1 ? p : undefined })} />
              </>
            )}
          </section>
        </main>

        <aside aria-label="รายละเอียดทริป" className="flex flex-col gap-5 border-l border-line bg-surface p-6">
          {detail ? <TripPanel detail={detail} /> : <p className="m-0 text-sm text-ink-muted">เลือกทริปจากรายการเพื่อดูรายละเอียด</p>}
        </aside>
      </div>
    </>
  );
}

const countLabels: [keyof Awaited<ReturnType<typeof getAdminTrip>>["counts"], string][] = [
  ["places", "สถานที่"],
  ["planItems", "แผน"],
  ["expenses", "ค่าใช้จ่าย"],
  ["settlements", "การโอนคืน"],
  ["checklistItems", "เช็คลิสต์"],
  ["activity7d", "การแก้ไข 7 วัน"],
];

function TripPanel({ detail }: { detail: Awaited<ReturnType<typeof getAdminTrip>> }) {
  const { trip, members, counts, activity } = detail;
  const now = new Date();
  return (
    <>
      <div className={cn("flex flex-col gap-1 rounded-tile p-4 text-surface", solidBg[trip.cover])}>
        <span className="text-[13px] opacity-85">{trip.destination}</span>
        <span className="font-display text-xl font-semibold">{trip.name}</span>
        <span className="text-[13px] opacity-85">{formatDateRange(trip.startDate, trip.endDate)}</span>
        {trip.createdBy ? <span className="text-[13px] opacity-85">สร้างโดย {trip.createdBy.name}</span> : null}
      </div>
      <span className="self-start rounded-full bg-line-soft px-2.5 py-[3px] text-xs font-semibold text-ink-subtle">ดูอย่างเดียว</span>
      <div className="grid grid-cols-3 gap-2">
        {countLabels.map(([key, label]) => (
          <div key={key} className="flex flex-col gap-0.5 rounded-icon bg-surface-alt p-3">
            <span className="font-display text-xl font-semibold">{int(counts[key])}</span>
            <span className="text-xs text-ink-muted">{label}</span>
          </div>
        ))}
      </div>
      <section className="flex flex-col">
        <h2 className="m-0 mb-2 font-display text-[15px] font-semibold">สมาชิก</h2>
        {members.map((m) => {
          const row = (
            <>
              <Avatar name={m.displayName} color={m.color} size="xs" />
              <span className="flex-1 truncate font-semibold">{m.displayName}</span>
              <span className="text-xs text-ink-muted">{roleLabel[m.role]}</span>
            </>
          );
          const cls = "flex min-h-11 items-center gap-2.5 border-t border-line-soft text-sm text-ink no-underline";
          return m.userId ? (
            <Link key={m.id} href={`/admin/users/${m.userId}`} className={cn(cls, "hover:bg-surface-alt hover:text-ink")}>
              {row}
            </Link>
          ) : (
            <div key={m.id} className={cls}>
              {row}
            </div>
          );
        })}
      </section>
      <section className="flex flex-col">
        <h2 className="m-0 mb-2 font-display text-[15px] font-semibold">ความเคลื่อนไหวล่าสุด</h2>
        {activity.length === 0 ? <p className="m-0 border-t border-line-soft py-3 text-sm text-ink-muted">ยังไม่มีความเคลื่อนไหว</p> : null}
        {activity.map((a) => (
          <div key={a.id} className="flex flex-col gap-0.5 border-t border-line-soft py-2.5">
            <span className="text-sm">
              <strong className="font-semibold">{a.actorName}</strong> {a.text}
            </span>
            <span className="text-xs text-ink-muted">{formatTimestamp(a.createdAt, now)}</span>
          </div>
        ))}
      </section>
      <p className="m-0 text-xs leading-[1.6] text-ink-muted">ไม่แสดงค่าใช้จ่ายส่วนตัว เช็คลิสต์ส่วนตัว และไฟล์เอกสารของทริป</p>
    </>
  );
}
