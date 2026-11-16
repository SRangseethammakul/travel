import Link from "next/link";
import type { ReactNode } from "react";
import { SlipButton } from "@/components/expenses/SlipButton";
import { SampleQr } from "@/components/settle/SampleQr";
import { ConfirmReceivedButton, PayerPendingView, ReplaceSlipButton } from "@/components/settle/SettleActions";
import { Avatar } from "@/components/ui/Avatar";
import { BackHeader } from "@/components/ui/BackHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { getDocument, getDocumentUrl, getMembers, getSettlements, getTripBalances, requireTripMember } from "@/lib/api";
import type { Member } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/date";
import { suggestedRow, transferRows, type TransferStatus } from "@/lib/expenses";
import { formatMoney } from "@/lib/money/format";
import { myOtherRows, pickSettleRow, settleViewer, waitingAmount } from "@/lib/settle-view";

const STEPS: { status: Exclude<TransferStatus, "waiting">; label: string }[] = [
  { status: "pending", label: "รอโอน" },
  { status: "sent", label: "รอยืนยัน" },
  { status: "confirmed", label: "เสร็จสิ้น" },
];

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function Party({ member, isMe }: { member: Member; isMe: boolean }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Avatar name={member.displayName} color={member.color} size="xl" />
      <span className="text-[13px] font-semibold">
        {member.displayName}
        {isMe ? " (คุณ)" : ""}
      </span>
    </span>
  );
}

function StatusCard({ icon, tone, title, detail, children }: { icon: "clock" | "check"; tone: "todo" | "primary"; title: string; detail: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] bg-surface px-4 py-[18px]">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            tone === "todo" ? "bg-todo-soft text-todo" : "bg-primary-soft text-primary",
          )}
        >
          <Icon name={icon} size={22} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-[13px] text-ink-muted">{detail}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function SettleUpPage({ params, searchParams }: PageProps<"/trips/[tripId]/summary/settle">) {
  const { tripId } = await params;
  const query = await searchParams;
  const { trip, me } = await requireTripMember(tripId);
  const [balances, settlements, memberList] = await Promise.all([getTripBalances(tripId), getSettlements(tripId), getMembers(tripId)]);

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const summaryHref = `${base}/summary`;
  // A viewer's balances hold only their own row, so names come from the Member list.
  const members = new Map(memberList.map((m) => [m.id, m]));
  const rows = transferRows(
    memberList.map((m) => m.id),
    settlements,
    balances.transfers.map(suggestedRow),
  );
  const row = pickSettleRow(rows, me.id, { from: first(query.from), to: first(query.to) });

  const backFooter = (
    <footer className="sticky bottom-0 z-10 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
      <Link href={summaryHref} className={buttonClasses({ variant: "soft", size: "lg", block: true, className: "h-[54px] hover:text-ink" })}>
        กลับไปหน้าสรุป
      </Link>
    </footer>
  );

  if (!row) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        <BackHeader title="โอนเงินคืน" href={summaryHref} />
        <main className="flex flex-1 flex-col gap-3.5 px-5 pt-2 pb-6">
          <StatusCard icon="check" tone="primary" title="ไม่มียอดที่ต้องโอน" detail="รายการโอนนี้ไม่มีแล้ว หรือทุกคนเคลียร์ครบแล้ว" />
        </main>
        {backFooter}
      </div>
    );
  }

  const from = members.get(row.fromId)!;
  const to = members.get(row.toId)!;
  const viewer = settleViewer(row, me.id);
  const stepIndex = STEPS.findIndex((s) => s.status === row.status);
  const settlement =
    row.status === "confirmed"
      ? settlements.find((s) => s.id === row.key)
      : settlements.find((s) => s.fromId === row.fromId && s.toId === row.toId && s.status === "sent");
  const [slip, slipUrl] = settlement?.slipDocId
    ? await Promise.all([getDocument(tripId, settlement.slipDocId), getDocumentUrl(tripId, settlement.slipDocId)])
    : [null, null];
  const myOutstanding = balances.rows.find((r) => r.member.id === me.id)?.outstanding ?? 0;
  const others = myOtherRows(rows, me.id, row);
  const amount = formatMoney(row.amount);
  // What is left of this pair while a partial report waits for confirmation (APP-4).
  const left = waitingAmount(rows, row);
  // The header amount is the transfer itself, not the trip's Net Balance.
  const amountCaption = row.status === "pending" ? "ยอดที่ยังต้องโอน" : row.status === "sent" ? "ยอดที่แจ้งโอน" : "ยอดที่โอนแล้ว";

  const top = (
    <>
      <section aria-label="ยอดที่ต้องโอน" className="flex flex-col items-center gap-2.5 rounded-[22px] bg-surface px-4 py-[18px]">
        <div className="flex items-center gap-3">
          <Party member={from} isMe={from.id === me.id} />
          <Icon name="arrowRight" size={28} className="text-ink-muted" />
          <Party member={to} isMe={to.id === me.id} />
        </div>
        <Money value={row.amount} className="text-4xl leading-[1.1] font-semibold" />
        <span className="text-xs text-ink-muted">
          {amountCaption} · ทริป {trip.name}
        </span>
      </section>

      <ol aria-label="สถานะการโอน" className="m-0 grid list-none grid-cols-3 gap-1.5 p-0">
        {STEPS.map((s, i) => (
          <li key={s.status} aria-current={i === stepIndex ? "step" : undefined} className="flex flex-col gap-1.5">
            <span aria-hidden="true" className={cn("h-1 rounded-full transition-colors duration-300", i <= stepIndex ? "bg-primary" : "bg-line-strong")} />
            <span className={cn("text-xs font-semibold", i <= stepIndex ? "text-primary" : "text-ink-muted")}>{s.label}</span>
          </li>
        ))}
      </ol>
    </>
  );

  const switcher = others.length ? (
    <nav aria-label="รายการโอนอื่นของคุณ" className="flex flex-col gap-1 rounded-card bg-surface px-4 py-2">
      <span className="pt-1 text-xs text-ink-muted">รายการโอนอื่นของคุณ</span>
      {others.map((o) => {
        const f = members.get(o.fromId)!;
        const t = members.get(o.toId)!;
        return (
          <Link
            key={o.key}
            href={`?from=${encodeURIComponent(o.fromId)}&to=${encodeURIComponent(o.toId)}`}
            className="flex min-h-11 items-center justify-between gap-2 border-t border-line-soft text-sm text-ink no-underline first-of-type:border-t-0 hover:text-primary"
          >
            <span>
              {f.displayName} → {t.displayName} · <Money value={o.amount} className="font-sans" />
            </span>
            <span className={cn("flex items-center gap-1 text-xs font-semibold", o.status === "sent" ? "text-todo" : "text-ink-muted")}>
              {o.status === "sent" ? "รอยืนยัน" : "รอโอน"}
              <Icon name="chevronRight" size={14} />
            </span>
          </Link>
        );
      })}
    </nav>
  ) : null;

  if (row.status === "pending" && viewer === "payer") {
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        <BackHeader title="โอนเงินคืน" href={summaryHref} />
        <PayerPendingView tripId={tripId} toId={to.id} remaining={row.amount} top={<>{top}{switcher}</>}>
          <h2 className="m-0 text-[15px] font-semibold">สแกนพร้อมเพย์ของ {to.displayName}</h2>
          <SampleQr label={`QR พร้อมเพย์ของ ${to.displayName} ภาพตัวอย่าง`} />
          <span className="text-xs text-ink-muted">[QR จริงสร้างจากเบอร์พร้อมเพย์และยอดเงิน]</span>
          <div className="flex w-full flex-col rounded-icon bg-bg px-3 py-2.5">
            <span className="text-xs text-ink-muted">พร้อมเพย์ · {to.displayName}</span>
            <span className="font-display text-base font-semibold tracking-[0.5px]">[เบอร์พร้อมเพย์]</span>
          </div>
        </PayerPendingView>
      </div>
    );
  }

  let body: ReactNode;
  if (row.status === "pending") {
    body = (
      <StatusCard
        icon="clock"
        tone="todo"
        title={viewer === "receiver" ? `รอ ${from.displayName} โอนเงิน` : `รอ ${from.displayName} โอนให้ ${to.displayName}`}
        detail={viewer === "receiver" ? `เมื่อ ${from.displayName} แจ้งโอนแล้ว คุณจะยืนยันได้ที่หน้านี้` : "ยังไม่ได้แจ้งโอน"}
      />
    );
  } else if (row.status === "sent") {
    const sentDetail = (
      <>
        {slip ? "แนบสลิปแล้ว 1 ไฟล์" : "ไม่ได้แนบสลิป"}
        {settlement?.sentAt ? ` · ${formatTimestamp(settlement.sentAt, new Date())}` : ""}
      </>
    );
    body = (
      <StatusCard
        icon="clock"
        tone="todo"
        title={
          viewer === "payer"
            ? `แจ้งโอนแล้ว · รอ ${to.displayName} ยืนยัน`
            : viewer === "receiver"
              ? `${from.displayName} แจ้งโอนแล้ว · รอคุณยืนยัน`
              : `${from.displayName} แจ้งโอนแล้ว · รอ ${to.displayName} ยืนยัน`
        }
        detail={sentDetail}
      >
        {left ? (
          <p className="m-0 rounded-chip bg-todo-soft px-3 py-2 text-[13px] text-todo">
            ยังค้างอีก <Money value={left} className="font-sans font-semibold" />
            {viewer === "payer"
              ? ` · แจ้งโอนส่วนที่เหลือได้หลัง ${to.displayName} ยืนยันยอดนี้`
              : ` · ${from.displayName} แจ้งโอนส่วนที่เหลือได้หลัง${viewer === "receiver" ? "คุณ" : ` ${to.displayName} `}ยืนยันยอดนี้`}
          </p>
        ) : null}
        {slip ? (
          <div className="flex justify-start">
            <SlipButton name={slip.name} size={slip.size} mime={slip.mime} label="ดูสลิป" url={slipUrl} />
          </div>
        ) : null}
        {viewer === "payer" && settlement ? <ReplaceSlipButton tripId={tripId} settlementId={settlement.id} hasSlip={!!slip} /> : null}
        {viewer === "receiver" && settlement ? (
          <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
            <span className="text-xs text-ink-muted">ตรวจยอดในบัญชีของคุณก่อนยืนยัน</span>
            <ConfirmReceivedButton tripId={tripId} settlementId={settlement.id} label={`ยืนยันว่าได้รับ ${amount} แล้ว`} />
          </div>
        ) : null}
      </StatusCard>
    );
  } else {
    body = (
      <section className="flex flex-col items-center gap-2 rounded-[22px] bg-surface px-4 py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="check" size={28} />
        </span>
        <h2 className="m-0 font-display text-lg font-semibold">
          {viewer === "payer" ? `เคลียร์ยอดกับ ${to.displayName} แล้ว` : viewer === "receiver" ? `ได้รับเงินจาก ${from.displayName} แล้ว` : `${from.displayName} โอนให้ ${to.displayName} แล้ว`}
        </h2>
        <p className="m-0 text-sm text-ink-muted">
          {viewer === "receiver" ? "คุณ" : to.displayName}ยืนยันได้รับ {amount}
          {viewer !== "other" ? (
            <>
              {" "}
              · ยอด{myOutstanding < 0 ? "ค้างจ่าย" : myOutstanding > 0 ? "ที่จะได้คืน" : "ค้าง"}ของคุณในทริปนี้เป็น{" "}
              <Money value={Math.abs(myOutstanding)} className="font-sans font-semibold text-ink" />
            </>
          ) : null}
        </p>
      </section>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <BackHeader title="โอนเงินคืน" href={summaryHref} />
      <main className="flex flex-1 flex-col gap-3.5 px-5 pt-2 pb-6">
        {top}
        {body}
        {switcher}
      </main>
      {backFooter}
    </div>
  );
}
