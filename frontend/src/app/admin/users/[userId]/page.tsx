import Link from "next/link";
import type { Metadata } from "next";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { TripStatusBadge } from "@/components/admin/Pills";
import { Avatar } from "@/components/ui/Avatar";
import { solidBg } from "@/components/ui/colors";
import { getAdmin, getAdminUser } from "@/lib/api/admin";
import { cn } from "@/lib/cn";
import { roleLabel } from "@/lib/labels";
import { formatDateRange, formatTimestamp } from "@/lib/date";
import { first, formatThaiDate, providerLabel } from "@/utils/admin";
import { ForceSignOut } from "./ForceSignOut";

export const metadata: Metadata = { title: "ผู้ใช้ · ผู้ดูแลระบบ" };

const roleStyle = { owner: "bg-primary-soft text-primary-ink", editor: "bg-interest-soft text-interest-ink", viewer: "bg-line-soft text-ink-subtle" } as const;

export default async function AdminUserPage(props: PageProps<"/admin/users/[userId]">) {
  const { userId } = await props.params;
  const sp = await props.searchParams;
  const [{ user, trips, activity }, me] = await Promise.all([getAdminUser(userId), getAdmin()]);
  const now = new Date();
  const signedOut = first(sp.signedout) === "1";
  const isSelf = me.id === user.id;
  const owned = trips.filter((t) => t.role === "owner").length;

  const facts: [string, string][] = [
    ["เข้าด้วย", providerLabel[user.provider]],
    ["สมัครเมื่อ", formatThaiDate(user.createdAt)],
    ["ใช้ล่าสุด", user.lastSeenAt ? formatTimestamp(user.lastSeenAt, now) : "—"],
    ["session", signedOut ? `version ${user.sessionVersion} (เพิ่งรีเซ็ต)` : `version ${user.sessionVersion}`],
    ["ทริปที่เป็นผู้จัดทริป", String(owned)],
    ["user id", user.id],
  ];

  return (
    <>
      <AdminTopBar title={user.name} back={{ href: "/admin/users", label: "ผู้ใช้" }}>
        {isSelf ? null : <ForceSignOut userId={user.id} name={user.name} />}
      </AdminTopBar>

      <main className="grid flex-1 grid-cols-12 content-start gap-5 px-8 py-6">
        {signedOut ? (
          <div role="status" className="col-span-12 rounded-icon bg-primary-soft px-5 py-3 text-sm font-semibold text-primary-ink">
            ออกจากระบบทุกเครื่องแล้ว {user.name} ต้องเข้าสู่ระบบใหม่
          </div>
        ) : null}

        <section className="col-span-4 flex flex-col gap-4 rounded-tile bg-surface p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} color={user.color} src={user.avatarUrl} size="xl" className="size-16! text-[26px]!" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-xl font-semibold">{user.name}</span>
              <span className="truncate text-sm text-ink-subtle">{user.email}</span>
            </span>
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="m-0 font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 rounded-chip bg-surface-alt p-3 text-[13px] leading-[1.6] text-ink-subtle">ผู้ดูแลดูได้อย่างเดียว ไม่เห็นค่าใช้จ่ายส่วนตัวและเช็คลิสต์ส่วนตัวของผู้ใช้</p>
        </section>

        <section className="col-span-8 flex flex-col rounded-tile bg-surface px-6 py-5">
          <h2 className="m-0 mb-2 font-display text-base font-semibold">ทริปที่อยู่ ({trips.length})</h2>
          {trips.length === 0 ? <p className="m-0 border-t border-line-soft py-6 text-sm text-ink-muted">ยังไม่ได้อยู่ในทริปไหน</p> : null}
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/admin/trips?selected=${t.id}`}
              className="grid min-h-[60px] grid-cols-[8px_1fr_100px_120px_100px] items-center gap-4 border-t border-line-soft text-sm text-ink no-underline hover:bg-surface-alt hover:text-ink"
            >
              <span aria-hidden="true" className={cn("h-9 rounded", solidBg[t.cover])} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{t.name}</span>
                <span className="text-xs text-ink-muted">{formatDateRange(t.startDate, t.endDate)}</span>
              </span>
              <span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", roleStyle[t.role])}>{roleLabel[t.role]}</span>
              </span>
              <span className="text-ink-subtle">{t.memberCount} คน</span>
              <span>
                <TripStatusBadge status={t.status} />
              </span>
            </Link>
          ))}
        </section>

        <section className="col-span-12 flex flex-col rounded-tile bg-surface px-6 py-5">
          <h2 className="m-0 mb-2 font-display text-base font-semibold">ความเคลื่อนไหวล่าสุด</h2>
          {activity.length === 0 ? <p className="m-0 border-t border-line-soft py-6 text-sm text-ink-muted">ยังไม่มีความเคลื่อนไหว</p> : null}
          {activity.map((a) => (
            <div key={a.id} className="grid min-h-12 grid-cols-[140px_200px_1fr] items-center gap-4 border-t border-line-soft text-sm">
              <span className="text-[13px] text-ink-muted">{formatTimestamp(a.createdAt, now)}</span>
              <span className="truncate text-ink-subtle">{a.tripName}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
