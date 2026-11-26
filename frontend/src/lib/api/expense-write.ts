/**
 * Expense writes shared by the expense actions and the hotel actions. Not a
 * "use server" file: these are helpers called inside an action, never endpoints.
 */
import { checkExpenseDraft, type ExpenseDraft } from "@/lib/expense-draft";
import { stayExpenseDraft } from "@/lib/stay-expense";
import { deleteDocumentQuietly, slipFile, uploadSlip } from "./documents";
import { actionError, apiFetch, tripPath } from "./http";
import { getMembers, getTrip } from "./queries";
import type { Expense, ID, Member, Place, PlaceStay, Trip } from "./types";

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
export async function writeExpense(
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
    const card = draft.method === "card" ? checked.cardName : undefined;
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
            // PATCH: null clears the field, a missing key keeps it. Legacy cardLast4 is never sent, so old data keeps it.
            cardName: card ?? null,
            ...(uploaded ? { slipDocId: uploaded } : draft.slip === null ? { slipDocId: null } : {}),
          }
        : {
            ...(card ? { cardName: card } : {}),
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

/** B16 — link a hotel to the Expense that records its price (`stay` is replaced whole, so the rest of it is sent again). */
export async function linkStayExpense(tripId: ID, placeId: ID, expenseId: ID, stay?: PlaceStay): Promise<void> {
  const current = stay ?? (await apiFetch<Place>(`${tripPath(tripId)}/places/${encodeURIComponent(placeId)}`)).stay;
  if (!current) return;
  await apiFetch(`${tripPath(tripId)}/places/${encodeURIComponent(placeId)}`, {
    method: "PATCH",
    json: { stay: { ...current, expenseId } },
  });
}

/**
 * "บันทึกเป็นค่าใช้จ่ายด้วย" — records a hotel's price as an Expense in the same save: paid by me, split
 * equally between all active members, then linked to the hotel. `error` tells the user what is left undone.
 */
export async function createStayExpenseFor(
  tripId: ID,
  place: Pick<Place, "id" | "name" | "stay">,
  me: Pick<Member, "id">,
): Promise<{ error: string } | { expense: Expense; memberCount: number }> {
  const stay = place.stay;
  if (!stay?.price) return { error: "ไม่มีราคาที่พักให้จดเป็นค่าใช้จ่าย" };
  const [trip, members] = await Promise.all([getTrip(tripId), getMembers(tripId)]);
  if (!trip) return { error: "ไม่พบทริปนี้" };
  const active = members.filter((m) => !m.status || m.status === "active");
  const draft = stayExpenseDraft({ placeName: place.name, stay: { checkIn: stay.checkIn, price: stay.price }, trip, payerId: me.id, memberIds: active.map((m) => m.id) });
  const r = await writeExpense(tripId, null, draft);
  if ("error" in r) return r;
  try {
    await linkStayExpense(tripId, place.id, r.expense.id, stay);
  } catch (e) {
    return { error: `บันทึกค่าใช้จ่ายแล้ว แต่ผูกกับที่พักไม่สำเร็จ: ${actionError(e).error}` };
  }
  return { expense: r.expense, memberCount: active.length };
}
