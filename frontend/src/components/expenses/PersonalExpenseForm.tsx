"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fieldClass, fieldLabelClass, textareaClass } from "@/components/ui/field";
import { savePersonalExpense } from "@/lib/api/personal-expense-actions";
import type { ID, PaymentMethod } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { PAYMENT_METHODS } from "@/lib/expense-draft";
import { expenseCategoryFormLabel, paymentMethodLabel } from "@/lib/labels";
import { formatBahtInput, parseBahtInput, satangToInput } from "@/lib/money/input";
import {
  MAX_PERSONAL_NOTE,
  MAX_PERSONAL_TITLE,
  PERSONAL_EXPENSE_CATEGORIES,
  type PersonalExpenseDraft,
} from "@/lib/personal-expense-form";

const methodIcon: Record<PaymentMethod, IconName> = { cash: "cash", promptpay: "transfer", card: "card", wallet: "wallet" };

interface PersonalExpenseFormProps {
  tripId: ID;
  /** null = new record. */
  id: ID | null;
  trip: { startDate: string; endDate: string };
  /** `amount` in satang, 0 = empty. */
  initial: PersonalExpenseDraft;
  /** Extra content under the fields (the delete button on the edit page). */
  children?: ReactNode;
}

/**
 * Add / edit a Personal Expense: amount, title, date, category, payment method
 * and note (shared fields in the same order as ExpenseForm). No payer, split or slip (self-designed from AddExpense's fields).
 */
export function PersonalExpenseForm({ tripId, id, trip, initial, children }: PersonalExpenseFormProps) {
  const ids = useId();
  const [amountText, setAmountText] = useState(satangToInput(initial.amount));
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [date, setDate] = useState(initial.date);
  const [method, setMethod] = useState(initial.method);
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const amount = parseBahtInput(amountText) ?? 0;
  const canSave = amount > 0 && title.trim().length > 0 && !pending;
  const hint = amount <= 0 ? "ใส่จำนวนเงิน" : !title.trim() ? "ใส่ชื่อรายการ" : null;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave) return;
    setError("");
    startTransition(async () => {
      const result = await savePersonalExpense(tripId, id, { title, category, amount, method, date, note });
      if (result?.error) setError(result.error);
    });
  };

  const legend = "mb-2 p-0 text-sm font-semibold";

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-5">
        <div className="flex flex-col items-center gap-1.5 pt-4 pb-2">
          <label htmlFor={`${ids}-amount`} className="text-[13px] text-ink-muted">
            จำนวนเงิน (บาท)
          </label>
          <div className="flex items-baseline gap-1">
            <span aria-hidden="true" className="font-display text-[28px] font-semibold text-ink-muted">
              ฿
            </span>
            <input
              id={`${ids}-amount`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              onChange={(e) => setAmountText(formatBahtInput(e.target.value))}
              className="w-full max-w-[220px] rounded-chip border-0 bg-transparent p-0 text-center font-display text-[44px] font-semibold text-ink tabular-nums placeholder:text-line-strong focus-visible:outline-offset-4"
            />
          </div>
          <p className="m-0 flex items-center gap-1 text-xs text-ink-muted">
            <Icon name="lock" size={14} />
            เห็นแค่คุณคนเดียว ไม่นำไปหารกับใคร
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-title`} className={fieldLabelClass}>
            รายการ
          </label>
          <input
            id={`${ids}-title`}
            type="text"
            maxLength={MAX_PERSONAL_TITLE}
            placeholder="เช่น ของฝาก Don Quijote"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-date`} className={fieldLabelClass}>
            วันที่
          </label>
          <input
            id={`${ids}-date`}
            type="date"
            min={trip.startDate}
            max={trip.endDate}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className={legend}>หมวดหมู่</legend>
          <div role="radiogroup" aria-label="หมวดหมู่" className="flex flex-wrap gap-2">
            {PERSONAL_EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} kind="radio" tone="ink" selected={category === c} onClick={() => setCategory(c)}>
                {expenseCategoryFormLabel[c]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className={legend}>ช่องทางชำระเงิน</legend>
          <div role="radiogroup" aria-label="ช่องทางชำระเงิน" className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const on = method === pm;
              return (
                <button
                  key={pm}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod(pm)}
                  className={cn(
                    "flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-icon border-[1.5px] px-3 text-left text-sm font-semibold text-ink transition-colors duration-150",
                    on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <Icon name={methodIcon[pm]} size={22} className="shrink-0" />
                  {paymentMethodLabel[pm]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-note`} className={fieldLabelClass}>
            โน้ต (ไม่บังคับ)
          </label>
          <textarea
            id={`${ids}-note`}
            rows={3}
            maxLength={MAX_PERSONAL_NOTE}
            placeholder="เช่น ซื้อฝากที่บ้าน"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaClass}
          />
        </div>

        {children}
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" block disabled={!canSave} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? "กำลังบันทึก…" : hint ? `บันทึก · ${hint}` : "บันทึก"}
        </Button>
      </footer>
    </form>
  );
}
