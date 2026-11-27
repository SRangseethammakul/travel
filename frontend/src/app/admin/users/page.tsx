import Link from "next/link";
import type { Metadata } from "next";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { EmptyResult } from "@/components/admin/EmptyResult";
import { Pager } from "@/components/admin/Pager";
import { FilterPill, ProviderBadge } from "@/components/admin/Pills";
import { SearchBox } from "@/components/admin/SearchBox";
import { Avatar } from "@/components/ui/Avatar";
import { getAdminUsers } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { adminHref, first, formatSeen, formatThaiDate, int, parsePage, pick } from "@/utils/admin";

export const metadata: Metadata = { title: "ผู้ใช้ · ผู้ดูแลระบบ" };

const PROVIDERS = ["all", "google", "line"] as const;
const SORTS = ["createdAt", "lastSeenAt", "name"] as const;
const COLS = "grid grid-cols-[2.4fr_2.4fr_1fr_0.8fr_1.2fr_1.2fr] items-center gap-4 px-5";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() || undefined;
  const provider = pick(sp.provider, PROVIDERS, "all");
  const sort = pick(sp.sort, SORTS, "createdAt");
  const dir = pick(sp.dir, ["asc", "desc"] as const, sort === "name" ? "asc" : "desc");
  const page = parsePage(sp.page);

  const data = await getAdminUsers({ q, provider: provider === "all" ? undefined : provider, sort, dir, page });
  const now = new Date();

  const url = (over: Record<string, string | number | undefined | null> = {}) =>
    adminHref("/admin/users", { q, provider: provider === "all" ? undefined : provider, sort: sort === "createdAt" && dir === "desc" ? undefined : sort, dir: sort === "createdAt" && dir === "desc" ? undefined : dir, page: page > 1 ? page : undefined, ...over });
  const sortHref = (col: (typeof SORTS)[number]) =>
    url({ sort: col, dir: col === sort ? (dir === "asc" ? "desc" : "asc") : col === "name" ? "asc" : "desc", page: undefined });
  const arrow = (col: string) => (col === sort ? (dir === "asc" ? " ↑" : " ↓") : "");

  const head = (col: (typeof SORTS)[number], label: string) => (
    <span role="columnheader" aria-sort={col === sort ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={sortHref(col)} className="text-ink-muted no-underline hover:text-ink">
        {label}
        {arrow(col)}
      </Link>
    </span>
  );

  return (
    <>
      <AdminTopBar title="ผู้ใช้" count={`${int(data.total)} คน`}>
        <SearchBox action="/admin/users" placeholder="ค้นหาชื่อหรืออีเมล…" value={q} keep={{ provider: provider === "all" ? undefined : provider }} />
      </AdminTopBar>

      <main className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex items-center gap-2" role="group" aria-label="กรองตามวิธีเข้าสู่ระบบ">
          {PROVIDERS.map((p) => (
            <FilterPill key={p} href={url({ provider: p === "all" ? undefined : p, page: undefined })} on={p === provider}>
              {p === "all" ? "ทั้งหมด" : p === "google" ? "Google" : "LINE"}
            </FilterPill>
          ))}
        </div>

        <section role="table" aria-label="ผู้ใช้" className="overflow-hidden rounded-tile bg-surface">
          <div role="row" className={cn(COLS, "h-11 border-b border-line bg-surface-alt text-xs font-semibold text-ink-muted")}>
            {head("name", "ชื่อ")}
            <span role="columnheader">อีเมล</span>
            <span role="columnheader">เข้าด้วย</span>
            <span role="columnheader" className="text-right">
              ทริป
            </span>
            {head("createdAt", "สมัครเมื่อ")}
            {head("lastSeenAt", "ใช้ล่าสุด")}
          </div>

          {data.items.length === 0 ? (
            <EmptyResult
              title={q ? `ไม่พบผู้ใช้ที่ตรงกับ “${q}”` : "ไม่พบผู้ใช้"}
              hint="ลองค้นด้วยอีเมล หรือเอาตัวกรองออก"
              clearHref="/admin/users"
            />
          ) : (
            <>
              {data.items.map((u) => (
                <div key={u.id} role="row" className={cn(COLS, "relative min-h-14 border-b border-line-soft text-sm hover:bg-surface-alt")}>
                  <span role="cell" className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.name} color={u.color} src={u.avatarUrl} size="sm" />
                    <Link href={`/admin/users/${u.id}`} className="truncate font-semibold text-ink no-underline after:absolute after:inset-0 hover:text-ink">
                      {u.name}
                    </Link>
                  </span>
                  <span role="cell" className="truncate text-ink-subtle">
                    {u.email}
                  </span>
                  <span role="cell">
                    <ProviderBadge provider={u.provider} />
                  </span>
                  <span role="cell" className="text-right font-display font-semibold">
                    {u.tripCount}
                  </span>
                  <span role="cell" className="text-ink-subtle">
                    {formatThaiDate(u.createdAt)}
                  </span>
                  <span role="cell" className="text-ink-subtle">
                    {formatSeen(u.lastSeenAt, now)}
                  </span>
                </div>
              ))}
              <Pager page={data.page} pageSize={data.pageSize} total={data.total} shown={data.items.length} href={(p) => url({ page: p > 1 ? p : undefined })} />
            </>
          )}
        </section>
      </main>
    </>
  );
}
