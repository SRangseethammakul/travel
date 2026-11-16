"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { removePersonalExpense } from "@/lib/api/personal-expense-actions";
import type { ID } from "@/lib/api/types";

/** "ลบรายการนี้" + confirmation sheet for a Personal Expense. */
export function DeletePersonalExpenseButton({ tripId, id, title }: { tripId: ID; id: ID; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  // The form's sticky save bar covers the bottom of the page, so bring the error into view above it.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center" });
  }, [error]);

  const confirm = () =>
    startTransition(async () => {
      const result = await removePersonalExpense(tripId, id);
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
    });

  return (
    <div className="flex flex-col gap-2 pt-2">
      {error ? (
        <p ref={errorRef} role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button variant="danger-outline" block icon={<Icon name="trash" size={18} />} onClick={() => setOpen(true)}>
        ลบรายการนี้
      </Button>
      <ConfirmDialog
        open={open}
        title={`ลบ "${title}"?`}
        description="รายการนี้เป็นของคุณคนเดียว ลบแล้วจะไม่นับในยอดที่คุณใช้ และกู้คืนไม่ได้"
        confirmLabel="ลบรายการ"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
