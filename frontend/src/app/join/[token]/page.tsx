import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JoinTripForm, type JoinOption } from "@/components/trip/JoinTripForm";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getInvitePreview, getSessionUserId } from "@/lib/api";
import { formatDateRange, formatTripLength } from "@/lib/date";
import { formatMoney } from "@/lib/money/format";

export const metadata: Metadata = { title: "เข้าร่วมทริป · [ชื่อแอป]" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function Notice({ icon, title, detail, children }: { icon: "check" | "clock" | "link"; title: string; detail: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-bg p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
          <Icon name={icon} size={22} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-[13px] leading-normal text-ink-muted">{detail}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function JoinTripPage({ params, searchParams }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const [preview, userId] = await Promise.all([getInvitePreview(token), getSessionUserId()]);

  if (!preview) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col bg-surface px-5 pt-5 pb-8">
        <main className="flex flex-1 flex-col justify-center gap-4">
          <Notice icon="link" title="ลิงก์เชิญนี้ใช้ไม่ได้แล้ว" detail="ลิงก์อาจหมดอายุหรือถูกรีเซ็ต ขอลิงก์ใหม่จากผู้จัดทริป" />
          <Link href="/trips" className={buttonClasses({ size: "lg", block: true, className: "rounded-2xl hover:text-surface" })}>
            ไปที่ทริปของฉัน
          </Link>
        </main>
      </div>
    );
  }

  const { trip, inviter } = preview;
  // B9 has no member / place / expense counts yet; show only the ones it sends.
  const stats = ([
    [preview.memberCount, "สมาชิก"],
    [preview.placeCount, "สถานที่"],
    [preview.expenseCount, "ค่าใช้จ่าย"],
  ] satisfies [number | null, string][]).filter((s): s is [number, string] => s[0] !== null);
  // B9 lists only Unclaimed Members, so there are no "already joined" rows.
  const options: JoinOption[] = preview.unclaimed.map(({ member, expenseCount, total }) => ({
    id: member.id,
    name: member.displayName,
    color: member.color,
    taken: false,
    sub: expenseCount ? `ยังไม่มีเจ้าของ · ${expenseCount} รายการ ส่วนที่ต้องจ่าย ${formatMoney(total)}` : "ยังไม่มีเจ้าของ",
  }));
  const as = first(query.as);
  const initialPick = as === "new" || options.some((o) => o.id === as) ? as! : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <main className="flex flex-1 flex-col gap-5 px-5 pt-5">
        {inviter ? (
          <div className="flex items-center gap-2.5 rounded-icon bg-bg px-3 py-2.5">
            <Avatar name={inviter.name} color={inviter.color} size="sm" />
            <span className="text-sm">
              <strong className="font-semibold">{inviter.name}</strong> ชวนคุณเข้าร่วมทริป
            </span>
          </div>
        ) : null}

        <section aria-labelledby="join-trip-name" className="flex flex-col gap-3 rounded-trip bg-ink p-5 text-surface">
          <span className="text-[13px] text-on-ink-muted">{trip.destination}</span>
          <h1 id="join-trip-name" className="m-0 font-display text-[26px] leading-[1.25] font-semibold">
            {trip.name}
          </h1>
          <span className="text-sm text-on-ink-soft">
            {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
          </span>
          {stats.length ? (
          <dl className="m-0 grid grid-cols-[repeat(3,minmax(min-content,1fr))] gap-2 border-t border-ink-divider pt-3">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-xs text-on-ink-muted">{label}</dt>
                <dd className="m-0 font-display text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          ) : null}
        </section>

        <JoinTripForm
          token={token}
          options={options}
          initialPick={initialPick}
          initialName={(first(query.name) ?? "").slice(0, 40)}
          signedIn={userId !== null}
        />
      </main>
    </div>
  );
}
