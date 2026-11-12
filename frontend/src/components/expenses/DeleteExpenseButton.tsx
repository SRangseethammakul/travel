"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { removeExpense } from "@/lib/api/expense-actions";
import type { ID } from "@/lib/api/types";

/** "ลบรายการนี้" + confirmation sheet (ExpenseDetail mockup). */
export function DeleteExpenseButton({ tripId, expenseId, title }: { tripId: ID; expenseId: ID; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await removeExpense(tripId, expenseId);
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
    });

  return (
    <>
      <Button variant="danger-outline" block icon={<Icon name="trash" size={18} />} onClick={() => setOpen(true)}>
        ลบรายการนี้
      </Button>
      {error ? (
        <p role="alert" className="m-0 text-center text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        title={`ลบ "${title}"?`}
        description="ยอดที่ทุกคนต้องจ่ายจะคำนวณใหม่ และสมาชิกทุกคนจะได้รับแจ้งเตือน"
        confirmLabel="ลบรายการ"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
