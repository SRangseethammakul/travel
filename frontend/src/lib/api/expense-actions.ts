"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkExpenseDraft, type ExpenseDraft } from "@/lib/expense-draft";
import { deleteDocumentQuietly, slipFile, uploadSlip } from "./documents";
import { actionError, apiFetch, tripPath } from "./http";
import { getMembers, getTrip } from "./queries";
import { itemDay } from "@/lib/plan";
import type { Expense, ID, PlanItem, Trip } from "./types";

export type ActionResult = { error: string } | null;

/** Expenses, Summary, Main, Trips cards and Activity all change after a money write. */
function revalidateTripPages() {
  revalidatePath("/", "layout");
}

/** B29/B30 share input: `equal` → who, `amount` → how much, `shares` → how many parts. The backend resolves amounts. */
function shareInput(draft: ExpenseDraft) {
  return draft.participantIds.map((memberId) =>
    draft.splitMode === "amount"
      ? { memberId, amount: draft.amounts?.[memberId] ?? 0 }
      : draft.splitMode === "shares"
        ? { memberId, weight: draft.weights?.[memberId] ?? 1 }
        : { memberId },
  );
}

/**
 * Create (expenseId = null, B29) or update (B30) an Expense. The draft is checked
 * here only for fast feedback; the backend checks permissions and the money rules
 * and its Thai message is shown when it refuses. A new slip arrives as the `slip`
 * File in `slipForm`: it is uploaded first (B12) and deleted again (B14) when the
 * Expense cannot be saved.
 */
async function writeExpense(
  tripId: ID,
  expenseId: ID | null,
  draft: ExpenseDraft,
  slipForm?: FormData | null,
): Promise<{ error: string } | { expense: Expense; trip: Trip }> {
  const file = draft.method === "promptpay" ? slipFile(slipForm) : null;
  if (file) draft = { ...draft, slip: { name: file.name, mime: file.type, size: file.size } };

  let uploaded: ID | null = null;
  try {
    const [trip, members] = await Promise.all([getTrip(tripId), getMembers(tripId)]);
    if (!trip) return { error: "ไม่พบทริปนี้" };
    const checked = checkExpenseDraft(draft, members.map((m) => m.id), trip);
    if (!checked.ok) return { error: checked.error };

    if (file) uploaded = await uploadSlip(tripId, file);
    const card = draft.method === "card" ? checked.cardLast4 : undefined;
    const body = {
      title: checked.title,
      category: draft.category,
      payerId: draft.payerId,
      method: draft.method,
      amount: draft.amount,
      date: draft.date,
      splitMode: draft.splitMode,
      shares: shareInput(draft),
      ...(expenseId
        ? {
            // PATCH: null clears the field, a missing key keeps it.
            cardLast4: card ?? null,
            ...(uploaded ? { slipDocId: uploaded } : draft.slip === null ? { slipDocId: null } : {}),
          }
        : {
            ...(card ? { cardLast4: card } : {}),
            ...(uploaded ? { slipDocId: uploaded } : {}),
          }),
    };
    const expense = expenseId
      ? await apiFetch<Expense>(`${tripPath(tripId)}/expenses/${encodeURIComponent(expenseId)}`, { method: "PATCH", json: body })
      : await apiFetch<Expense>(`${tripPath(tripId)}/expenses`, { method: "POST", json: body });
    return { expense, trip };
  } catch (e) {
    if (uploaded) await deleteDocumentQuietly(tripId, uploaded);
    return { error: actionError(e).error };
  }
}

export async function saveExpense(
  tripId: ID,
  expenseId: ID | null,
  draft: ExpenseDraft,
  slipForm?: FormData | null,
): Promise<ActionResult> {
  const r = await writeExpense(tripId, expenseId, draft, slipForm);
  if ("error" in r) return r;
  revalidateTripPages();
  const base = `/trips/${encodeURIComponent(tripId)}/expenses`;
  redirect(expenseId ? `${base}/${encodeURIComponent(r.expense.id)}` : base);
}

/**
 * AddExpense opened from AddTransit ("บันทึกเป็นค่าใช้จ่ายด้วย"): create the
 * Expense (B29), then link it to the Transit card (B26 `expenseId`).
 */
export async function saveTransitExpense(
  tripId: ID,
  transitId: ID,
  draft: ExpenseDraft,
  slipForm?: FormData | null,
): Promise<ActionResult> {
  const r = await writeExpense(tripId, null, draft, slipForm);
  if ("error" in r) return r;
  revalidateTripPages();
  let transit: PlanItem;
  try {
    transit = await apiFetch<PlanItem>(`${tripPath(tripId)}/plan/${encodeURIComponent(transitId)}`, {
      method: "PATCH",
      json: { expenseId: r.expense.id },
    });
  } catch (e) {
    return { error: `บันทึกค่าใช้จ่ายแล้ว แต่ผูกกับการเดินทางไม่สำเร็จ: ${actionError(e).error}` };
  }
  revalidateTripPages();
  redirect(`/trips/${encodeURIComponent(tripId)}/plan?day=${Math.max(1, itemDay(transit, r.trip))}`);
}

/** B31 — the backend decides who may delete. */
export async function removeExpense(tripId: ID, expenseId: ID): Promise<ActionResult> {
  try {
    await apiFetch<void>(`${tripPath(tripId)}/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidateTripPages();
  redirect(`/trips/${encodeURIComponent(tripId)}/expenses`);
}
