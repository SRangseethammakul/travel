"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPersonalExpenseDraft, type PersonalExpenseDraft } from "@/lib/personal-expense-form";
import type { ActionResult } from "./expense-actions";
import { ApiError, actionError, apiFetch, tripPath } from "./http";
import { getTrip } from "./queries";
import type { ID, PersonalExpense } from "./types";

/**
 * Personal Expenses (B45–B47). Any role may write their own; the backend checks
 * ownership and the trip dates. Only the expenses tab shows them, so group
 * pages (Summary, Activity, balances) need no refresh.
 */

const listPath = (tripId: ID) => `${tripPath(tripId)}/personal-expenses`;
const itemPath = (tripId: ID, id: ID) => `${listPath(tripId)}/${encodeURIComponent(id)}`;
const personalView = (tripId: ID) => `/trips/${encodeURIComponent(tripId)}/expenses?view=personal`;
const editPage = (tripId: ID, id: ID) => `/trips/${encodeURIComponent(tripId)}/expenses/personal/${encodeURIComponent(id)}`;

/** The record was deleted (e.g. from another tab) after this page loaded. */
const isGone = (e: unknown) => e instanceof ApiError && e.code === "personal_expense_not_found";

function revalidate(tripId: ID) {
  revalidatePath(`/trips/${encodeURIComponent(tripId)}/expenses`);
}

/**
 * Create (id = null, B45) or update (B46) a Personal Expense, then go back to the personal view.
 * Saving a record that is already gone reloads its page, which then shows "ไม่พบรายการนี้"
 * with a way back to the personal view.
 */
export async function savePersonalExpense(tripId: ID, id: ID | null, draft: PersonalExpenseDraft): Promise<ActionResult> {
  try {
    const trip = await getTrip(tripId);
    if (!trip) return { error: "ไม่พบทริปนี้" };
    const checked = checkPersonalExpenseDraft(draft, trip);
    if (!checked.ok) return { error: checked.error };
    const { note, cardName, ...rest } = checked.value;
    if (id) {
      // PATCH: note / cardName null clear them.
      await apiFetch<PersonalExpense>(itemPath(tripId, id), { method: "PATCH", json: { ...rest, note, cardName } });
    } else {
      await apiFetch<PersonalExpense>(listPath(tripId), {
        method: "POST",
        json: { ...rest, ...(note ? { note } : {}), ...(cardName ? { cardName } : {}) },
      });
    }
  } catch (e) {
    if (id && isGone(e)) {
      revalidate(tripId);
      redirect(editPage(tripId, id));
    }
    return { error: actionError(e).error };
  }
  revalidate(tripId);
  redirect(personalView(tripId));
}

/** B47. Deleting a record that is already gone counts as done. */
export async function removePersonalExpense(tripId: ID, id: ID): Promise<ActionResult> {
  try {
    await apiFetch<void>(itemPath(tripId, id), { method: "DELETE" });
  } catch (e) {
    if (!isGone(e)) return { error: actionError(e).error };
  }
  revalidate(tripId);
  redirect(personalView(tripId));
}
