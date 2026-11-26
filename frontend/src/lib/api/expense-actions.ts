"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ExpenseDraft } from "@/lib/expense-draft";
import { formatMoney } from "@/lib/money/format";
import { itemDay } from "@/lib/plan";
import { flash } from "./flash";
import { actionError, apiFetch, tripPath } from "./http";
import { linkStayExpense, writeExpense } from "./expense-write";
import { getExpense } from "./queries";
import type { ID, PlanItem } from "./types";

export type ActionResult = { error: string } | null;

/** Expenses, Summary, Main, Trips cards and Activity all change after a money write. */
function revalidateTripPages() {
  revalidatePath("/", "layout");
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
  await flash(expenseId ? "แก้ไขค่าใช้จ่ายแล้ว" : "บันทึกค่าใช้จ่ายแล้ว");
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
  await flash("บันทึกค่าใช้จ่ายแล้ว");
  redirect(`/trips/${encodeURIComponent(tripId)}/plan?day=${Math.max(1, itemDay(transit, r.trip))}`);
}

/**
 * AddExpense opened from a hotel ("บันทึกเป็นค่าใช้จ่ายด้วย"): create the Expense (B29), then link it to the
 * hotel (B16: `stay` is replaced whole, so the rest of the stay is sent again with `expenseId`).
 */
export async function saveStayExpense(
  tripId: ID,
  placeId: ID,
  draft: ExpenseDraft,
  slipForm?: FormData | null,
): Promise<ActionResult> {
  const r = await writeExpense(tripId, null, draft, slipForm);
  if ("error" in r) return r;
  revalidateTripPages();
  try {
    await linkStayExpense(tripId, placeId, r.expense.id);
  } catch (e) {
    return { error: `บันทึกค่าใช้จ่ายแล้ว แต่ผูกกับที่พักไม่สำเร็จ: ${actionError(e).error}` };
  }
  revalidateTripPages();
  await flash("บันทึกค่าใช้จ่ายแล้ว");
  redirect(`/trips/${encodeURIComponent(tripId)}/expenses`);
}

/** B31 — the backend decides who may delete. */
export async function removeExpense(tripId: ID, expenseId: ID): Promise<ActionResult> {
  const before = await getExpense(tripId, expenseId).catch(() => null);
  try {
    await apiFetch<void>(`${tripPath(tripId)}/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidateTripPages();
  await flash(before ? `ลบค่าใช้จ่าย ${formatMoney(before.amount)} แล้ว` : "ลบค่าใช้จ่ายแล้ว");
  redirect(`/trips/${encodeURIComponent(tripId)}/expenses`);
}
