"use client";

import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import { saveExpense, saveTransitExpense } from "@/lib/api/expense-actions";
import type { ColorKey, ExpenseCategory, ID, PaymentMethod, SplitMode } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { EXPENSE_CATEGORIES, MAX_TITLE, PAYMENT_METHODS, type ExpenseDraft } from "@/lib/expense-draft";
import { expenseCategoryFormLabel, paymentMethodLabel, splitModeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money/format";
import { formatBahtInput, parseBahtInput, satangToInput } from "@/lib/money/input";
import { computeSplit, spreadRemaining, type SplitResult } from "@/lib/money/split";
import { SlipPicker } from "./SlipPicker";

export interface FormMember {
  id: ID;
  name: string;
  color: ColorKey;
}

export interface ExpenseFormInitial {
  title: string;
  category: ExpenseCategory;
  payerId: ID;
  method: PaymentMethod;
  cardLast4: string;
  date: string;
  amount: number; // satang, 0 = empty
  splitMode: SplitMode;
  participantIds: ID[];
  amounts: Record<ID, number>;
  weights: Record<ID, number>;
  /** Name of the slip already attached (edit only). */
  slipName: string | null;
}

interface ExpenseFormProps {
  tripId: ID;
  expenseId: ID | null;
  members: FormMember[];
  trip: { startDate: string; endDate: string };
  initial: ExpenseFormInitial;
  /** Opened from AddTransit: the new expense is linked to this Transit card. */
  transitId?: ID;
}

const methodIcon: Record<PaymentMethod, IconName> = { cash: "cash", promptpay: "transfer", card: "card", wallet: "wallet" };
const MODES: SplitMode[] = ["equal", "amount", "shares"];

const fieldClass =
  "h-12 w-full rounded-icon border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors hover:border-ink-muted focus-visible:border-primary";

/** AddExpense (page 4) and its edit mode: amount, title, category, payer, payment method and the split. */
export function ExpenseForm({ tripId, expenseId, members, trip, initial, transitId }: ExpenseFormProps) {
  const ids = useId();
  const [amountText, setAmountText] = useState(satangToInput(initial.amount));
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [method, setMethod] = useState(initial.method);
  const [cardLast4, setCardLast4] = useState(initial.cardLast4);
  const [date, setDate] = useState(initial.date);
  const [selected, setSelected] = useState<Set<ID>>(() => new Set(initial.participantIds));
  const [mode, setMode] = useState(initial.splitMode);
  const [custom, setCustom] = useState<Record<ID, string>>(() =>
    Object.fromEntries(Object.entries(initial.amounts).map(([id, v]) => [id, satangToInput(v)])),
  );
  const [weights, setWeights] = useState<Record<ID, number>>(initial.weights);
  // undefined = keep the existing slip, null = removed, File = newly picked (uploaded by the action).
  const [slip, setSlip] = useState<File | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const amount = parseBahtInput(amountText) ?? 0;
  const participantIds = members.filter((m) => selected.has(m.id)).map((m) => m.id);
  const n = participantIds.length;
  const amounts = useMemo(
    () => Object.fromEntries(Object.entries(custom).map(([id, text]) => [id, parseBahtInput(text) ?? 0])),
    [custom],
  );

  const split: SplitResult | null = useMemo(() => {
    try {
      return computeSplit({ mode, total: amount, payerId, participantIds, amounts, weights });
    } catch {
      return null;
    }
  }, [mode, amount, payerId, participantIds, amounts, weights]);

  const shareOf = new Map(split?.shares.map((s) => [s.memberId, s.amount]));
  const totalWeight = participantIds.reduce((s, id) => s + (weights[id] ?? 1), 0);
  const nameOf = (id: ID | null) => members.find((m) => m.id === id)?.name ?? "";
  const ready = n > 0 && amount > 0;
  const balanced = !!split?.balanced;
  const canSave = ready && balanced && title.trim().length > 0 && !pending;

  const saveLabel = !ready
    ? "ใส่จำนวนเงินและคนที่หาร"
    : !balanced
      ? "ยอดที่แบ่งยังไม่ตรง"
      : !title.trim()
        ? "ใส่ชื่อรายการ"
        : mode === "equal"
          ? `คนละ ${formatMoney(Math.floor(amount / n))}`
          : mode === "shares"
            ? `รวม ${totalWeight} ส่วน`
            : "แบ่งครบแล้ว";

  let status: { text: string; tone: string; spread: boolean } | null = null;
  if (split && mode === "amount" && amount > 0 && n > 0) {
    if (split.remaining === 0) status = { text: `แบ่งครบ ${formatMoney(amount)} พอดี`, tone: "bg-primary-soft text-primary-ink", spread: false };
    else if (split.remaining > 0) status = { text: `ยังเหลือ ${formatMoney(split.remaining)} ที่ยังไม่ได้แบ่ง`, tone: "bg-todo-soft text-todo", spread: true };
    else status = { text: `แบ่งเกินมา ${formatMoney(-split.remaining)}`, tone: "bg-danger-soft text-danger-ink", spread: false };
  } else if (split && mode === "equal" && split.roundingRemainder > 0) {
    const to = split.remainderTo === payerId ? "ผู้จ่าย" : nameOf(split.remainderTo);
    status = { text: `หารไม่ลงตัว เศษ ${formatMoney(split.roundingRemainder)} รวมไว้กับ${to}`, tone: "bg-bg text-ink-subtle", spread: false };
  }

  const toggle = (id: ID) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const spread = () => {
    const next = spreadRemaining(amount, participantIds, amounts);
    setCustom((prev) => ({ ...prev, ...Object.fromEntries(participantIds.map((id) => [id, satangToInput(next[id] ?? 0)])) }));
  };


  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave) return;
    setError("");
    const draft: ExpenseDraft = {
      title,
      category,
      payerId,
      method,
      cardLast4: method === "card" ? cardLast4 : "",
      date,
      amount,
      splitMode: mode,
      participantIds,
      ...(mode === "amount" ? { amounts: Object.fromEntries(participantIds.map((id) => [id, amounts[id] ?? 0])) } : {}),
      ...(mode === "shares" ? { weights: Object.fromEntries(participantIds.map((id) => [id, weights[id] ?? 1])) } : {}),
      ...(method === "promptpay"
        ? slip !== undefined
          ? { slip: slip && { name: slip.name, mime: slip.type, size: slip.size } }
          : {}
        : { slip: null }),
    };
    let slipForm: FormData | null = null;
    if (method === "promptpay" && slip) {
      slipForm = new FormData();
      slipForm.append("slip", slip);
    }
    startTransition(async () => {
      const result =
        transitId && !expenseId ? await saveTransitExpense(tripId, transitId, draft, slipForm) : await saveExpense(tripId, expenseId, draft, slipForm);
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
              className="w-[220px] rounded-chip border-0 bg-transparent p-0 text-center font-display text-[44px] font-semibold text-ink tabular-nums placeholder:text-line-strong focus-visible:outline-offset-4"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-title`} className="text-sm font-semibold">
            รายการ
          </label>
          <input
            id={`${ids}-title`}
            type="text"
            maxLength={MAX_TITLE}
            placeholder="เช่น ยากินิคุหลังสถานี"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-date`} className="text-sm font-semibold">
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
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} kind="radio" tone="ink" selected={category === c} onClick={() => setCategory(c)}>
                {expenseCategoryFormLabel[c]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className={legend}>จ่ายโดย</legend>
          <div role="radiogroup" aria-label="จ่ายโดย" className="grid grid-cols-4 gap-2">
            {members.map((m) => {
              const on = payerId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPayerId(m.id)}
                  className={cn(
                    "flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-1 py-2.5 text-ink transition-colors duration-150",
                    on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <Avatar name={m.name} color={m.color} size="md" />
                  <span className="max-w-full truncate text-[13px] font-semibold">{m.name}</span>
                </button>
              );
            })}
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

          {method === "promptpay" ? (
            <div className="mt-2.5">
              <SlipPicker
                label="แนบสลิปการโอน (ไม่บังคับ)"
                value={slip ? { name: slip.name, size: slip.size } : slip === undefined && initial.slipName ? { name: initial.slipName } : null}
                onPick={setSlip}
                onRemove={() => setSlip(null)}
              />
            </div>
          ) : null}

          {method === "card" ? (
            <div className="mt-2.5 flex flex-col gap-1.5">
              <label htmlFor={`${ids}-card`} className="text-[13px] text-ink-muted">
                เลขท้ายบัตร 4 หลัก (ไม่บังคับ)
              </label>
              <input
                id={`${ids}-card`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="••••"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className={cn(fieldClass, "tracking-[4px]")}
              />
            </div>
          ) : null}
        </fieldset>

        <section aria-labelledby={`${ids}-split`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id={`${ids}-split`} className="m-0 text-sm font-semibold">
              หารกับ ({n} คน)
            </h2>
            <button
              type="button"
              onClick={() => setSelected(new Set(members.map((m) => m.id)))}
              disabled={n === members.length}
              className="min-h-11 cursor-pointer rounded-chip border-0 bg-transparent px-2 text-sm font-semibold text-primary hover:text-primary-hover disabled:cursor-default disabled:text-ink-muted"
            >
              เลือกทุกคน
            </button>
          </div>
          <Segmented
            label="วิธีหาร"
            value={mode}
            onChange={setMode}
            options={MODES.map((m) => ({ value: m, label: splitModeLabel[m].label }))}
          />
          <p className="m-0 text-xs text-ink-muted">{splitModeLabel[mode].hint}</p>

          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-line p-0">
            {members.map((m) => {
              const on = selected.has(m.id);
              const share = shareOf.get(m.id) ?? 0;
              return (
                <li key={m.id} className="flex min-h-[60px] items-center gap-2 border-b border-line-soft bg-surface pr-3 last:border-b-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m.id)}
                    className="flex min-h-[60px] min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-0 pr-0 pl-3.5 text-left text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 text-surface transition-colors duration-150",
                        on ? "border-primary bg-primary" : "border-disabled bg-surface",
                      )}
                    >
                      {on ? <Icon name="check" size={14} /> : null}
                    </span>
                    <Avatar name={m.name} color={m.color} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{m.name}</span>
                      {on && mode === "shares" ? (
                        <span className="text-xs text-ink-muted">
                          <Money value={share} className="font-sans" />
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {!on ? (
                    <span className="text-[15px] text-ink-muted">ไม่ร่วม</span>
                  ) : mode === "equal" ? (
                    <Money value={share} className="text-[15px] font-semibold" />
                  ) : mode === "amount" ? (
                    <span className="flex h-11 w-[112px] items-center gap-1 rounded-[10px] border border-line-strong px-2.5 focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                      <span aria-hidden="true" className="text-sm text-ink-muted">
                        ฿
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`ส่วนของ ${m.name} (บาท)`}
                        placeholder="0"
                        value={custom[m.id] ?? ""}
                        onChange={(e) => setCustom((prev) => ({ ...prev, [m.id]: formatBahtInput(e.target.value) }))}
                        className="w-full min-w-0 border-0 bg-transparent p-0 text-right font-display text-[15px] font-semibold text-ink tabular-nums outline-none focus-visible:outline-none"
                      />
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`ลดส่วนของ ${m.name}`}
                        disabled={(weights[m.id] ?? 1) <= 1}
                        onClick={() => setWeights((w) => ({ ...w, [m.id]: Math.max(1, (w[m.id] ?? 1) - 1) }))}
                        className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong bg-surface text-ink hover:bg-bg disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-surface"
                      >
                        <Icon name="minus" size={18} />
                      </button>
                      <span aria-live="polite" aria-label={`${weights[m.id] ?? 1} ส่วน`} className="w-7 text-center font-display text-[15px] font-semibold tabular-nums">
                        {weights[m.id] ?? 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`เพิ่มส่วนของ ${m.name}`}
                        disabled={(weights[m.id] ?? 1) >= 99}
                        onClick={() => setWeights((w) => ({ ...w, [m.id]: Math.min(99, (w[m.id] ?? 1) + 1) }))}
                        className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong bg-surface text-ink hover:bg-bg disabled:cursor-not-allowed disabled:text-disabled"
                      >
                        <Icon name="plus" size={18} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div aria-live="polite">
            {status ? (
              <div className={cn("flex min-h-11 items-center justify-between gap-2 rounded-chip px-3 py-1.5 text-[13px] font-semibold", status.tone)}>
                <span>{status.text}</span>
                {status.spread ? (
                  <button
                    type="button"
                    onClick={spread}
                    className="relative min-h-8 shrink-0 cursor-pointer rounded-lg border border-current bg-surface px-2.5 text-xs font-semibold text-inherit before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-todo-soft"
                  >
                    เกลี่ยให้คนที่เหลือ
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" block disabled={!canSave} aria-busy={pending || undefined} className="h-[54px]">
          {pending ? "กำลังบันทึก…" : `บันทึก · ${saveLabel}`}
        </Button>
      </footer>
    </form>
  );
}
