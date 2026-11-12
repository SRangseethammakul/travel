"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import type { ID } from "./types";

/** B14 — the backend decides (owner or uploader; a slip in use → 409 `document_in_use`). */
export async function removeDocumentAction(tripId: ID, docId: ID): Promise<ActionResult> {
  try {
    await apiFetch<void>(`${tripPath(tripId)}/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidatePath(`/trips/${encodeURIComponent(tripId)}`, "layout");
  return null;
}
