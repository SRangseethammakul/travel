import type { Metadata } from "next";
import { headers } from "next/headers";
import { InviteSettings } from "@/components/members/InviteSettings";
import { MemberList, type MemberRow } from "@/components/members/MemberList";
import { BackHeader } from "@/components/ui/BackHeader";
import { CopyInviteButton } from "@/components/trip/CopyInviteButton";
import { getInvite, getMembers, inviteExpiryOption, isInviteActive, requireTripMember } from "@/lib/api";
import { formatTimestamp } from "@/lib/date";
import { canManageMembers } from "@/lib/permissions";

export const metadata: Metadata = { title: "สมาชิกและสิทธิ์ · [ชื่อแอป]" };

const ROLE_HELP = [
  ["ผู้จัดทริป", "แก้ได้ทุกอย่าง จัดการสมาชิกและลิงก์เชิญ ลบทริป"],
  ["แก้ไขได้", "เพิ่มสถานที่ แผน และค่าใช้จ่าย · แก้หรือลบได้เฉพาะค่าใช้จ่ายที่ตัวเองสร้าง"],
  ["ดูอย่างเดียว", "ดูแผนและยอดของตัวเอง แจ้งโอนเงินได้"],
] as const;

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function MembersPage({ params }: PageProps<"/trips/[tripId]/members">) {
  const { tripId } = await params;
  const { trip, me } = await requireTripMember(tripId);
  const canManage = canManageMembers(me);
  const [members, invite] = await Promise.all([getMembers(tripId), getInvite(tripId)]);
  const base = `/trips/${encodeURIComponent(tripId)}`;
  const path = invite ? `/join/${encodeURIComponent(invite.token)}` : null;
  const active = invite ? isInviteActive(invite) : false;

  const rows: MemberRow[] = members.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    color: m.color,
    role: m.role,
    isMe: m.id === me.id,
    unclaimed: m.userId === null,
    pending: m.status === "pending",
    login:
      m.status === "pending"
        ? `รออนุมัติ${m.joinedVia ? ` · ${m.joinedVia === "line" ? "LINE" : "Google"}` : ""}`
        : m.userId === null
        ? `ยังไม่เข้าร่วม${invite ? " · ส่งลิงก์แล้ว" : ""}`
        : m.joinedVia
          ? `เข้าสู่ระบบด้วย ${m.joinedVia === "line" ? "LINE" : "Google"}`
          : "เข้าร่วมแล้ว",
  }));

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader title="สมาชิกและสิทธิ์" subtitle={`${trip.name} · ${members.length} คน`} href={base} />
      <main className="flex flex-1 flex-col gap-[18px] px-5 pt-2 pb-6">
        <MemberList tripId={tripId} rows={rows} canManage={canManage} />

        <section aria-labelledby="roles-h" className="flex flex-col gap-2 rounded-tile bg-surface p-3.5">
          <h2 id="roles-h" className="m-0 mb-0.5 text-sm font-semibold">
            แต่ละสิทธิ์ทำอะไรได้
          </h2>
          <dl className="m-0 flex flex-col gap-2">
            {ROLE_HELP.map(([role, text]) => (
              <div key={role} className="flex gap-2.5 text-[13px] leading-normal">
                <dt className="w-[82px] shrink-0 font-semibold">{role}</dt>
                <dd className="m-0 text-ink-subtle">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {canManage ? (
          <InviteSettings
            tripId={tripId}
            url={path ? `${await siteOrigin()}${path}` : null}
            expiry={invite ? inviteExpiryOption(invite) : "7d"}
            expired={Boolean(invite) && !active}
            expiryNote={
              !invite ? null : !active ? "ลิงก์หมดอายุแล้ว เลือกระยะเวลาใหม่หรือรีเซ็ตลิงก์" : invite.expiresAt ? `หมดอายุ ${formatTimestamp(invite.expiresAt)}` : "ใช้ได้จนกว่าจะรีเซ็ต"
            }
            requireApproval={invite?.requireApproval ?? true}
          />
        ) : path && active ? (
          <section aria-labelledby="invite-h" className="flex flex-col gap-2 rounded-tile bg-surface p-3.5">
            <h2 id="invite-h" className="m-0 text-sm font-semibold">
              ลิงก์เชิญ
            </h2>
            <p className="m-0 text-xs text-ink-muted">ผู้จัดทริปเป็นคนตั้งค่าลิงก์ คุณคัดลอกไปส่งให้เพื่อนได้</p>
            <CopyInviteButton path={path} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
