import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import type { Member } from "@/lib/api/types";
import type { TransferRow } from "@/lib/expenses";

interface Props {
  base: string;
  /** Rows where I am the payer (pending / sent / waiting). */
  toPay: readonly TransferRow[];
  /** Rows where I am the receiver and a report is waiting for me (sent). */
  toConfirm: readonly TransferRow[];
  members: readonly Member[];
}

/** One tap from the Expenses page to the Settle Up page of that pair. */
export function TransferStrip({ base, toPay, toConfirm, members }: Props) {
  if (!toPay.length && !toConfirm.length) return null;
  const byId = new Map(members.map((m) => [m.id, m]));

  const group = (id: string, heading: string, rows: readonly TransferRow[], mode: "pay" | "confirm") => {
    if (!rows.length) return null;
    return (
      <section aria-labelledby={id} className="flex flex-col gap-2">
        <h2 id={id} className="m-0 text-sm font-semibold text-ink-muted">
          {heading}
        </h2>
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
          {rows.map((r) => {
            const other = byId.get(mode === "pay" ? r.toId : r.fromId);
            const name = other?.displayName ?? "สมาชิก";
            const text =
              mode === "confirm"
                ? `${name} แจ้งโอน · กดยืนยันรับ`
                : r.status === "sent"
                  ? `แจ้งโอนแล้ว · รอ ${name} ยืนยัน`
                  : r.status === "waiting"
                    ? `เหลืออีก · ${name}`
                    : `โอนให้ ${name}`;
            return (
              <li key={`${mode}-${r.key}`} className="border-b border-line-soft last:border-b-0">
                <Link
                  href={`${base}/summary/settle?from=${encodeURIComponent(r.fromId)}&to=${encodeURIComponent(r.toId)}`}
                  className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 text-ink no-underline hover:bg-surface-alt hover:text-ink"
                >
                  <Avatar name={name} color={other?.color ?? "gray"} size="md" />
                  <span className="min-w-0 flex-1 font-semibold">{text}</span>
                  <Money
                    value={r.amount}
                    className={mode === "pay" && r.status === "pending" ? "shrink-0 font-semibold text-danger" : "shrink-0 font-semibold"}
                  />
                  <Icon name="chevronRight" size={16} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-[18px]">
      {group("strip-pay", "ต้องโอนให้", toPay, "pay")}
      {group("strip-confirm", "รอยืนยันรับเงิน", toConfirm, "confirm")}
    </div>
  );
}
