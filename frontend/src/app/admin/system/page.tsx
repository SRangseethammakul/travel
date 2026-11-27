import type { Metadata } from "next";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { Pager } from "@/components/admin/Pager";
import { FilterPill } from "@/components/admin/Pills";
import { getAdminSystem } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { adminHref, barPercent, formatClock, formatUptime, int, parsePage, pick } from "@/utils/admin";
import { AutoRefresh } from "./AutoRefresh";

export const metadata: Metadata = { title: "ระบบ · ผู้ดูแลระบบ" };

const FILTERS = [
  ["all", "ทั้งหมด"],
  ["4xx", "4xx"],
  ["5xx", "5xx"],
  ["slow", "ช้า ≥ 500 ms"],
] as const;
const SLOW_MS = 500;
const COLS = "grid grid-cols-[110px_70px_1fr_70px_80px_140px] items-center gap-3 px-5";

export default async function AdminSystemPage({ searchParams }: PageProps<"/admin/system">) {
  const sp = await searchParams;
  const filter = pick(sp.filter, FILTERS.map((f) => f[0]), "all");
  const page = parsePage(sp.page);
  const data = await getAdminSystem({ filter, page });
  const now = new Date();

  const health = [
    { label: "API", value: `${data.api.p95Ms1h} ms`, sub: `p95 ใน 1 ชม. · ทำงานมา ${formatUptime(data.api.uptimeSec)}`, ok: true },
    { label: "MongoDB", value: `${data.mongo.pingMs} ms`, sub: `ping ${data.mongo.ok ? "ok" : "ไม่ตอบสนอง"} · ${data.mongo.collections} collections`, ok: data.mongo.ok },
    { label: "ที่เก็บไฟล์", value: data.storage.driver, sub: "STORAGE_DRIVER", ok: true },
    { label: "Rate limit (auth)", value: int(data.rateLimit.blocked24h), sub: "ครั้งที่ถูกบล็อกใน 24 ชม.", ok: data.rateLimit.blocked24h === 0 },
  ];
  const peak = Math.max(1, ...data.errorsByHour.map((h) => h.c4xx + h.c5xx));
  const hours = data.errorsByHour;
  const hourLabel = (iso: string) => formatClock(iso).slice(0, 5);
  const url = (over: Record<string, string | number | undefined>) => adminHref("/admin/system", { filter: filter === "all" ? undefined : filter, ...over });

  return (
    <>
      <AutoRefresh seconds={30} />
      <AdminTopBar title="ระบบ">
        <span className="text-[13px] text-ink-muted">อัปเดต {formatClock(now.toISOString())} · รีเฟรชทุก 30 วิ</span>
      </AdminTopBar>

      <main className="grid flex-1 grid-cols-12 content-start gap-5 px-8 py-6">
        {health.map((h) => (
          <section key={h.label} className="col-span-3 flex flex-col gap-1.5 rounded-tile bg-surface p-5">
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span aria-hidden="true" className={cn("size-2 rounded-full", h.ok ? "bg-primary" : "bg-todo")} />
              {h.label}
            </span>
            <span className="font-display text-[26px] font-semibold">{h.value}</span>
            <span className="text-xs text-ink-subtle">{h.sub}</span>
          </section>
        ))}

        <section className="col-span-12 flex flex-col gap-3 rounded-tile bg-surface p-5">
          <div className="flex items-baseline gap-4">
            <h2 className="m-0 font-display text-base font-semibold">error ต่อชั่วโมง (24 ชม.)</h2>
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-danger" />
              5xx
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-todo-line" />
              4xx
            </span>
          </div>
          <div role="img" aria-label="กราฟแท่ง error รายชั่วโมง" className="flex h-[120px] items-end gap-1 border-b border-line">
            {hours.map((h) => (
              <div key={h.hour} title={`${hourLabel(h.hour)} · 4xx ${h.c4xx} · 5xx ${h.c5xx}`} className="flex h-full flex-1 flex-col justify-end">
                <span className="rounded-t-[3px] bg-todo-line" style={{ height: `${barPercent(h.c4xx, peak)}%` }} />
                <span className="bg-danger" style={{ height: `${barPercent(h.c5xx, peak)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-ink-muted">
            <span>{hours[0] ? hourLabel(hours[0].hour) : ""}</span>
            <span>{hours[Math.floor(hours.length / 2)] ? hourLabel(hours[Math.floor(hours.length / 2)].hour) : ""}</span>
            <span>ตอนนี้</span>
          </div>
        </section>

        <section role="table" aria-label="Request log" className="col-span-12 flex flex-col overflow-hidden rounded-tile bg-surface">
          <div className="flex items-center gap-2 px-5 py-4">
            <h2 className="m-0 mr-3 font-display text-base font-semibold">Request log</h2>
            {FILTERS.map(([key, label]) => (
              <FilterPill key={key} href={url({ filter: key === "all" ? undefined : key })} on={key === filter}>
                {label}
              </FilterPill>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-ink-muted">เก็บ 1,000 รายการล่าสุด</span>
          </div>
          <div role="row" className={cn(COLS, "h-10 border-y border-line bg-surface-alt text-xs font-semibold text-ink-muted")}>
            <span role="columnheader">เวลา</span>
            <span role="columnheader">method</span>
            <span role="columnheader">path</span>
            <span role="columnheader">status</span>
            <span role="columnheader" className="text-right">
              ms
            </span>
            <span role="columnheader">userId</span>
          </div>
          {data.logs.items.length === 0 ? <p className="m-0 px-5 py-10 text-center text-sm text-ink-muted">ไม่มีรายการที่ตรงกับตัวกรอง</p> : null}
          {data.logs.items.map((l) => (
            <div key={l.id} role="row" className={cn(COLS, "min-h-10 border-b border-line-soft font-mono text-[13px]")}>
              <span role="cell" className="text-ink-muted">
                {formatClock(l.at)}
              </span>
              <span role="cell" className="font-semibold">
                {l.method}
              </span>
              <span role="cell" className="truncate" title={l.path}>
                {l.path}
              </span>
              <span role="cell">
                <span className={cn("rounded-md px-2 py-px font-semibold", l.status >= 500 ? "bg-danger-soft text-danger-ink" : l.status >= 400 ? "bg-todo-soft text-todo" : "bg-primary-soft text-primary-ink")}>{l.status}</span>
              </span>
              <span role="cell" className={cn("text-right", l.ms >= SLOW_MS ? "text-danger-ink" : "text-ink-subtle")}>
                {int(l.ms)}
              </span>
              <span role="cell" className="truncate text-ink-subtle">
                {l.userId ?? "—"}
              </span>
            </div>
          ))}
          {data.logs.total > 0 ? <Pager page={data.logs.page} pageSize={data.logs.pageSize} total={data.logs.total} shown={data.logs.items.length} href={(p) => url({ page: p > 1 ? p : undefined })} /> : null}
        </section>
      </main>
    </>
  );
}
