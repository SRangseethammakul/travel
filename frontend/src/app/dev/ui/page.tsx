import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InteractiveDemo } from "@/components/dev/InteractiveDemo";
import {
  Avatar,
  AvatarStack,
  BackHeader,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Fab,
  Icon,
  IconButton,
  IconLink,
  Money,
  Pill,
  Segmented,
  TabBar,
  TagLabel,
} from "@/components/ui";
import { getCurrentMember, getCurrentUser, getMembers, getTripBalances } from "@/lib/api";
import { TRIP_IDS } from "@/test/fixtures/seed";

export const metadata: Metadata = { title: "UI components · [ชื่อแอป]", robots: { index: false } };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 font-display text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Temporary page to review every shared component. Not available in production. */
export default async function DevUiPage(props: PageProps<"/dev/ui">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { tab } = await props.searchParams;
  const status = tab === "past" ? "past" : "upcoming";
  const tripId = TRIP_IDS.tokyo;
  const [user, me, members, balances] = await Promise.all([
    getCurrentUser(),
    getCurrentMember(tripId),
    getMembers(tripId),
    getTripBalances(tripId),
  ]);
  const myRow = me ? balances.rows.find((r) => r.member.id === me.id) : undefined;

  return (
    <>
      <BackHeader title="ส่วนประกอบ UI" subtitle="หน้าชั่วคราวสำหรับตรวจ · ช่วง 1" href="/" action={<IconButton icon="edit" label="ตัวอย่างปุ่มไอคอน" />} />

      <main className="flex flex-col gap-6 px-5 pt-2 pb-48">
        <Section title="ข้อมูลจาก lib/api (cookie mock-user)">
          <Card className="gap-1.5 text-sm">
            <span>
              User: <strong>{user.name}</strong> · Member ในโตเกียว: <strong>{me ? me.displayName : "ไม่ได้เป็นสมาชิก"}</strong>
            </span>
            <span>
              ยอดรวมทั้งทริป <Money value={balances.total} className="font-semibold" />
            </span>
            {myRow ? (
              <span>
                Net Balance <Money value={myRow.net} sign="always" tone="balance" className="font-semibold" /> · Outstanding{" "}
                <Money value={myRow.outstanding} sign="always" tone="balance" className="font-semibold" />
              </span>
            ) : null}
          </Card>
        </Section>

        <Section title="Money">
          <Card className="gap-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Money value={480000} className="text-xl font-semibold" />
              <Money value={121250} className="text-xl font-semibold" />
              <Money value={1095000} sign="always" tone="balance" className="text-xl font-semibold" />
              <Money value={-515000} sign="always" tone="balance" className="text-xl font-semibold" />
              <Money value={0} sign="always" tone="balance" className="text-xl font-semibold" />
            </div>
          </Card>
        </Section>

        <Section title="Avatar">
          <Card className="gap-3">
            <div className="flex items-center gap-2">
              {members.map((m) => (
                <Avatar key={m.id} name={m.displayName} color={m.color} label={m.displayName} />
              ))}
              <Avatar name="Kong" color="gray" size="md" />
              <Avatar name="N" color="slate" size="sm" />
            </div>
            <AvatarStack people={members.map((m) => ({ id: m.id, name: m.displayName, color: m.color }))} />
          </Card>
        </Section>

        <Section title="Button">
          <div className="flex flex-col gap-2">
            <Button size="lg" block>
              บันทึก
            </Button>
            <Button size="lg" block disabled>
              ยอดที่แบ่งยังไม่ตรง
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary">ยกเลิก</Button>
              <Button variant="soft">ยกเลิก</Button>
            </div>
            <Button variant="danger" size="lg" block>
              ลบรายการ
            </Button>
            <Button variant="danger-outline" block icon={<Icon name="trash" size={20} />}>
              ลบรายการนี้
            </Button>
            <Button variant="dashed" size="sm" block icon={<Icon name="link" size={20} />}>
              คัดลอกลิงก์เชิญเข้าทริป
            </Button>
            <ButtonLink href="/dev/ui" variant="primary" block icon={<Icon name="plus" size={20} />}>
              สร้างทริปใหม่ (ลิงก์)
            </ButtonLink>
          </div>
        </Section>

        <Section title="IconButton">
          <div className="flex items-center gap-2">
            <IconLink href="/dev/ui" icon="bell" label="ความเคลื่อนไหว ยังไม่อ่าน 3 รายการ" badge={3} />
            <IconLink href="/dev/ui" icon="plus" label="สร้างทริปใหม่" variant="primary" />
            <IconButton icon="sort" label="จัดเรียงแผน" />
            <IconButton icon="tag" label="จัดการ tag และย่าน" />
            <IconButton icon="more" label="ตัวเลือกสมาชิก Mint" variant="muted" />
            <IconButton icon="close" label="ปิด" variant="ghost" />
          </div>
        </Section>

        <Section title="Card">
          <Card tone="ink" padding="lg" className="gap-1">
            <span className="text-[13px] text-on-ink-muted">โตเกียว · ญี่ปุ่น</span>
            <span className="font-display text-[26px] leading-tight font-semibold">โตเกียวหน้าหนาว</span>
            <span className="text-sm text-on-ink-soft">ส. 12 – อ. 15 ธ.ค. 2569 · 4 วัน 3 คืน</span>
          </Card>
          <Card className="gap-3">
            <CardHeader title="สมาชิก (4)" action={<Pill>จัดการสมาชิก</Pill>} />
            <p className="m-0 text-[13px] text-ink-muted">การ์ดทั่วไป มุมมน 20px พื้นขาว</p>
          </Card>
          <Card tone="primary" padding="sm" className="gap-1">
            <span className="text-[13px] text-primary-ink-soft">ส่วนของคุณ ฿7,950</span>
            <Money value={1095000} sign="always" className="text-[22px] font-semibold text-primary" />
          </Card>
        </Section>

        <Section title="Pill · TagLabel">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>ที่พัก</Pill>
            <Pill tone="todo">รอยืนยัน</Pill>
            <Pill tone="danger">ค้างชำระ</Pill>
            <Pill tone="neutral">วางแผน</Pill>
            <TagLabel>ราเมง</TagLabel>
            <TagLabel>ต้องจอง</TagLabel>
          </div>
        </Section>

        <Section title="Segmented (ลิงก์ · searchParams)">
          <Segmented
            label="สถานะทริป"
            value={status}
            options={[
              { value: "upcoming", label: "กำลังจะไป", href: "/dev/ui" },
              { value: "past", label: "ผ่านมาแล้ว", href: "/dev/ui?tab=past" },
            ]}
          />
        </Section>

        <Section title="Interactive">
          <InteractiveDemo />
        </Section>

        <Section title="Fab · TabBar">
          <p className="m-0 text-[13px] text-ink-muted">ปุ่มลอยและแถบเมนูล่างแสดงอยู่ด้านล่างของหน้าจอ (แท็บชี้ไปทริปโตเกียว)</p>
        </Section>
      </main>

      <Fab href="/dev/ui" label="เพิ่มค่าใช้จ่าย" />
      <TabBar tripId={tripId} />
    </>
  );
}
