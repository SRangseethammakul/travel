"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { deleteTransitAction } from "@/lib/api/plan-actions";
import type { ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { FLASH_EVENT } from "@/lib/flash";
import { formatMoney } from "@/lib/money/format";

export interface TransitMenuProps {
  tripId: ID;
  itemId: ID;
  /** "HND → BKK" */
  name: string;
  /** The linked Expense, when there is one (`canDelete`: the viewer may delete it too). */
  expense?: { id: ID; amount: number; canDelete: boolean };
}

const row = "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-icon border-0 bg-bg px-4 text-left text-[15px] font-semibold text-ink no-underline hover:bg-line-soft hover:text-ink";

/** ⋯ on a Transit card: edit it, or delete it (asking about its linked expense first). */
export function TransitMenu({ tripId, itemId, name, expense }: TransitMenuProps) {
  const [sheet, setSheet] = useState<"menu" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = (withExpense: boolean) =>
    startTransition(async () => {
      setError("");
      const r = await deleteTransitAction(tripId, itemId, withExpense && expense?.canDelete ? expense.id : undefined);
      if (r?.error) setError(r.error);
      else {
        setSheet(null);
        window.dispatchEvent(new Event(FLASH_EVENT));
      }
    });

  const canDeleteBoth = !!expense?.canDelete;
  const amount = expense ? formatMoney(expense.amount) : "";

  return (
    <>
      <button
        type="button"
        aria-label={`ตัวเลือกของการเดินทาง ${name}`}
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setSheet("menu");
        }}
        className="relative -my-1 -mr-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border-0 bg-transparent text-ink-subtle hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="more" size={18} />
      </button>

      <BottomSheet open={sheet === "menu"} onClose={() => setSheet(null)} caption="การเดินทาง" title={name}>
        <div className="flex flex-col gap-2">
          <Link href={`/trips/${encodeURIComponent(tripId)}/plan/transit/${encodeURIComponent(itemId)}/edit`} className={row} data-autofocus>
            <Icon name="edit" size={18} />
            แก้ไขการเดินทาง
          </Link>
          <button type="button" onClick={() => setSheet("remove")} className={cn(row, "text-danger")}>
            <Icon name="trash" size={18} />
            ลบการเดินทาง
          </button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={sheet === "remove"}
        title={`ลบการเดินทาง ${name}?`}
        description={
          error ||
          (expense
            ? canDeleteBoth
              ? `การเดินทางนี้บันทึกเป็นค่าใช้จ่าย ${amount} ไว้ด้วย จะลบค่าใช้จ่ายนั้นไปด้วยไหม ย้อนกลับไม่ได้`
              : `การเดินทางนี้บันทึกเป็นค่าใช้จ่าย ${amount} ไว้ แต่คุณไม่มีสิทธิ์ลบรายการนั้น รายการจะยังอยู่ ย้อนกลับไม่ได้`
            : "ลบออกจากแผนแล้วย้อนกลับไม่ได้")
        }
        confirmLabel={canDeleteBoth ? `ลบการเดินทางและค่าใช้จ่าย ${amount}` : "ลบการเดินทาง"}
        {...(canDeleteBoth ? { secondaryLabel: "ลบเฉพาะการเดินทาง เก็บค่าใช้จ่ายไว้", onSecondary: () => remove(false) } : {})}
        pending={pending}
        onConfirm={() => remove(true)}
        onCancel={() => setSheet(null)}
      />
    </>
  );
}
