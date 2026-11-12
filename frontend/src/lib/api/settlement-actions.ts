"use server";

import { revalidatePath } from "next/cache";
import { deleteDocumentQuietly, slipFile, uploadSlip } from "./documents";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import { isStaleSettlementError } from "./settlement-errors";
import type { ID, Settlement } from "./types";

const settlementsPath = (tripId: ID) => `${tripPath(tripId)}/settlements`;

/**
 * The backend refused. When the refusal means the page is out of date (someone
 * else already reported or confirmed), re-render it so the current state shows
 * under the backend's message.
 */
function refused(e: unknown): ActionResult {
  const { error, code } = actionError(e);
  if (isStaleSettlementError(code)) revalidatePath("/", "layout");
  return { error };
}

/**
 * B32 — the Current Member reports "แจ้งว่าโอนแล้ว" to `toId`. No amount is sent,
 * so the backend uses the Suggested Transfer, lowered to what is not reported yet.
 * An optional slip (`slip` File in `slipForm`) is uploaded first (B12) and deleted
 * again (B14) when the report is refused.
 */
export async function markTransferSent(tripId: ID, toId: ID, slipForm: FormData | null): Promise<ActionResult> {
  const file = slipFile(slipForm);
  let uploaded: ID | null = null;
  try {
    if (file) uploaded = await uploadSlip(tripId, file);
    await apiFetch<Settlement>(settlementsPath(tripId), {
      method: "POST",
      json: { toId, ...(uploaded ? { slipDocId: uploaded } : {}) },
    });
  } catch (e) {
    if (uploaded) await deleteDocumentQuietly(tripId, uploaded);
    return refused(e);
  }
  revalidatePath("/", "layout");
  return null;
}

/** B34 — the sender attaches or replaces the slip while the Settlement is still `sent`. */
export async function replaceTransferSlip(tripId: ID, settlementId: ID, slipForm: FormData): Promise<ActionResult> {
  const file = slipFile(slipForm);
  if (!file) return { error: "เลือกไฟล์สลิปก่อน" };
  let uploaded: ID | null = null;
  try {
    uploaded = await uploadSlip(tripId, file);
    await apiFetch<Settlement>(`${settlementsPath(tripId)}/${encodeURIComponent(settlementId)}/slip`, {
      method: "POST",
      json: { slipDocId: uploaded },
    });
  } catch (e) {
    if (uploaded) await deleteDocumentQuietly(tripId, uploaded);
    return refused(e);
  }
  revalidatePath("/", "layout");
  return null;
}

/** B33 — the receiver confirms they got the money; only then does Outstanding change. */
export async function confirmTransfer(tripId: ID, settlementId: ID): Promise<ActionResult> {
  try {
    await apiFetch<Settlement>(`${settlementsPath(tripId)}/${encodeURIComponent(settlementId)}/confirm`, { method: "POST" });
  } catch (e) {
    return refused(e);
  }
  revalidatePath("/", "layout");
  return null;
}
