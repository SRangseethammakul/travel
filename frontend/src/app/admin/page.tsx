import Link from "next/link";
import type { Metadata } from "next";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { SearchBox } from "@/components/admin/SearchBox";
import { ProviderBadge } from "@/components/admin/Pills";
import { Avatar } from "@/components/ui/Avatar";
import { Money } from "@/components/ui/Money";
import { solidBg } from "@/components/ui/colors";
import { getAdminOverview, getAdminSystem } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { adminHref, barPercent, deltaText, errorRateLabel, errorTotals, first, formatSeen, formatShortDay, int, ownersLabel, pct, pick } from "@/utils/admin";

export const metadata: Metadata = { title: "ภาพรวม · ผู้ดูแลระบบ" };

const RANGES = ["7", "30", "90"] as const;

const card = "rounded-tile bg-surface p-5";
const h2 = "m-0 font-display text-base font-semibold";

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const range = pick(first(sp.days), RANGES, "30");
  const days = Number(range);
  const [data, system] = await Promise.all([getAdminOverview(days), getAdminSystem({ filter: "all" })]);
  const now = new Date();

  const { kpis } = data;
  const tiles = [
    { label: "ผู้ใช้ทั้งหมด", value: data.totals.users, delta: { text: `+${kpis.usersNew.current} ใน ${days} วัน`, down: false } },
    { label: "ทริปทั้งหมด", value: data.totals.trips, delta: { text: `+${kpis.tripsNew.current} ใน ${days} วัน`, down: false } },
    { label: "ทริปที่มีการแก้ไขสัปดาห์นี้", value: kpis.activeTrips7d.current, delta: deltaText(kpis.activeTrips7d.current, kpis.activeTrips7d.previous, "จากสัปดาห์ก่อน") },
    { label: "สมัครใหม่ 7 วัน", value: kpis.signups7d.current, delta: deltaText(kpis.signups7d.current, kpis.signups7d.previous, "จากสัปดาห์ก่อน") },
  ];

  const peak = Math.max(1, ...data.daily.flatMap((d) => [d.users, d.trips]));
  const providerTotal = data.providers.google + data.providers.line;
  const googlePct = pct(data.providers.google, providerTotal);
  const errs = errorTotals(system.errorsByHour);
  const rate = errorRateLabel(errs.c4xx + errs.c5xx, errs.total);
  const healthy = system.mongo.ok && errs.c5xx === 0;
  const firstDay = data.daily[0]?.date;
  const midDay = data.daily[Math.floor(data.daily.length / 2)]?.date;
  const lastDay = data.daily.at(-1)?.date;

  return (
    <>
      <AdminTopBar title="ภาพรวม">
        <SearchBox action="/admin/users" placeholder="ค้นหาผู้ใช้…" />
        <nav aria-label="ช่วงเวลา" className="flex gap-1 rounded-chip bg-line p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={adminHref("/admin", { days: r === "30" ? undefined : r })}
              aria-current={r === range ? "true" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-[9px] px-3 text-[13px] font-semibold no-underline",
                r === range ? "bg-surface text-ink hover:text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {r} วัน
            </Link>
          ))}
        </nav>
      </AdminTopBar>

      <main className="grid flex-1 grid-cols-12 content-start gap-5 px-8 py-6">
        <Link
          href="/admin/system"
          className={cn(
            "col-span-12 flex min-h-11 items-center gap-6 rounded-icon px-5 py-3 text-[13px] no-underline",
            healthy ? "bg-primary-soft text-primary-ink hover:text-primary-ink" : "bg-danger-soft text-danger-ink hover:text-danger-ink",
          )}
        >
          <strong className="font-semibold">{healthy ? "ระบบปกติ" : "ระบบมีปัญหา"}</strong>
          <span>API p95 {system.api.p95Ms1h} ms</span>
          <span>
            MongoDB {system.mongo.ok ? "ok" : "ไม่ตอบสนอง"} · {system.mongo.pingMs} ms
          </span>
          <span>ที่เก็บไฟล์: {system.storage.driver}</span>
          <span>{rate ? `error ${rate} ใน 24 ชม.` : `error 4xx ${int(errs.c4xx)} · 5xx ${int(errs.c5xx)} ใน 24 ชม.`}</span>
          <span className="ml-auto font-semibold">ดูระบบ →</span>
        </Link>

        {tiles.map((k) => (
          <section key={k.label} className={cn(card, "col-span-3 flex flex-col gap-1.5")}>
            <span className="text-[13px] text-ink-muted">{k.label}</span>
            <span className="font-display text-[32px] leading-[1.1] font-semibold">{int(k.value)}</span>
            <span className={cn("text-xs font-semibold", k.delta.down ? "text-danger-ink" : "text-primary-ink")}>{k.delta.text}</span>
          </section>
        ))}

        <section className={cn(card, "col-span-8 flex flex-col gap-4")}>
          <div className="flex items-baseline gap-4">
            <h2 className={h2}>ผู้ใช้ใหม่และทริปที่สร้าง</h2>
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-primary" />
              ผู้ใช้ใหม่
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-type-interest" />
              ทริปใหม่
            </span>
          </div>
          <div role="img" aria-label={`กราฟแท่งรายวัน ${days} วันล่าสุด`} className="flex h-[220px] items-end gap-1.5 border-b border-line pb-1">
            {data.daily.map((d) => (
              <div key={d.date} title={`${formatShortDay(d.date)} · ผู้ใช้ใหม่ ${d.users} · ทริปใหม่ ${d.trips}`} className="flex h-full flex-1 items-end gap-0.5">
                <span className="flex-1 rounded-t-[3px] bg-primary" style={{ height: `${barPercent(d.users, peak)}%` }} />
                <span className="flex-1 rounded-t-[3px] bg-type-interest" style={{ height: `${barPercent(d.trips, peak)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-ink-muted">
            <span>{firstDay ? formatShortDay(firstDay) : ""}</span>
            <span>{midDay ? formatShortDay(midDay) : ""}</span>
            <span>{lastDay ? formatShortDay(lastDay) : ""}</span>
          </div>
        </section>

        <section className={cn(card, "col-span-4 flex flex-col gap-4")}>
          <h2 className={h2}>เข้าสู่ระบบด้วย</h2>
          <div role="img" aria-label={`Google ${googlePct}% LINE ${providerTotal ? 100 - googlePct : 0}%`} className="flex h-3.5 overflow-hidden rounded-full bg-line-soft">
            <span className="bg-primary" style={{ width: `${googlePct}%` }} />
            <span className="bg-type-transit" style={{ width: `${providerTotal ? 100 - googlePct : 0}%` }} />
          </div>
          {(
            [
              ["Google", data.providers.google, "bg-primary"],
              ["LINE", data.providers.line, "bg-type-transit"],
            ] as const
          ).map(([name, count, color]) => (
            <div key={name} className="flex items-center gap-2.5 text-sm">
              <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", color)} />
              <span className="flex-1">{name}</span>
              <span className="font-display font-semibold">{int(count)}</span>
              <span className="w-11 text-right text-ink-muted">{pct(count, providerTotal)}%</span>
            </div>
          ))}
          <div className="mt-auto border-t border-line-soft pt-3 text-[13px] text-ink-subtle">
            ทริปเฉลี่ย {data.avgMembersPerTrip.toFixed(1)} คน · {Math.round(data.usersInTripPct)}% ของผู้ใช้อยู่อย่างน้อย 1 ทริป
          </div>
        </section>

        <section className={cn(card, "col-span-6 flex flex-col")}>
          <div className="flex items-center justify-between pb-2">
            <h2 className={h2}>สมัครล่าสุด</h2>
            <Link href="/admin/users" className="text-[13px] font-semibold">
              ดูทั้งหมด
            </Link>
          </div>
          {data.recentUsers.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="flex min-h-[52px] items-center gap-3 border-t border-line-soft text-ink no-underline hover:bg-surface-alt hover:text-ink">
              <Avatar name={u.name} color={u.color} src={u.avatarUrl} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{u.name}</span>
                <span className="truncate text-xs text-ink-muted">{u.email}</span>
              </span>
              <ProviderBadge provider={u.provider} />
              <span className="w-24 text-right text-xs text-ink-muted">{formatSeen(u.createdAt, now)}</span>
            </Link>
          ))}
        </section>

        <section className={cn(card, "col-span-6 flex flex-col")}>
          <div className="flex items-center justify-between pb-2">
            <h2 className={h2}>ทริปที่ใช้งานมากสุดสัปดาห์นี้</h2>
            <Link href="/admin/trips" className="text-[13px] font-semibold">
              ดูทั้งหมด
            </Link>
          </div>
          {data.busiestTrips.map((t) => (
            <Link key={t.id} href={`/admin/trips?selected=${t.id}`} className="flex min-h-[52px] items-center gap-3 border-t border-line-soft text-ink no-underline hover:bg-surface-alt hover:text-ink">
              <span aria-hidden="true" className={cn("h-8 w-2 rounded", solidBg[t.cover])} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{t.name}</span>
                <span className="truncate text-xs text-ink-muted">
                  {ownersLabel(t.owners)} · {t.memberCount} คน · {t.spent > 0 ? <Money value={t.spent} className="font-sans" /> : "ยังไม่มีค่าใช้จ่าย"}
                </span>
              </span>
              <span className="font-display text-sm font-semibold">{t.activity7d}</span>
              <span className="w-[60px] text-xs text-ink-muted">การแก้ไข</span>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
