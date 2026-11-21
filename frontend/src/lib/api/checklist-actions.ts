"use server";

import { revalidatePath } from "next/cache";
import { CUSTOM_CATEGORY, MAX_CHECKLIST_CATEGORY, MAX_CHECKLIST_TEXT } from "@/lib/checklist";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import type { ChecklistItem, ChecklistScope, ID } from "./types";

/** Checklist (B35–B37). The backend decides who may tick, assign, add or delete. */

const itemPath = (tripId: ID, itemId: ID) => `${tripPath(tripId)}/checklist/${encodeURIComponent(itemId)}`;

async function write(tripId: ID, fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    return { error: actionError(e).error };
  }
  // Checklist page + the summary card on the trip page.
  revalidatePath(`/trips/${encodeURIComponent(tripId)}`, "layout");
  return null;
}

/** B36 `{ done }` — the server sets `doneBy`. */
export async function toggleChecklistItem(tripId: ID, itemId: ID, done: boolean): Promise<ActionResult> {
  return write(tripId, () => apiFetch<ChecklistItem>(itemPath(tripId, itemId), { method: "PATCH", json: { done: Boolean(done) } }));
}

/** B36 `{ assigneeId }` — null unassigns. */
export async function assignChecklistItem(tripId: ID, itemId: ID, assigneeId: ID | null): Promise<ActionResult> {
  return write(tripId, () => apiFetch<ChecklistItem>(itemPath(tripId, itemId), { method: "PATCH", json: { assigneeId: assigneeId || null } }));
}

/** B35 — goes into `category` (an existing one or "เพิ่มเอง"); suggestions use "เพิ่มเอง". */
export async function addChecklistItemAction(tripId: ID, scope: ChecklistScope, text: string, category: string = CUSTOM_CATEGORY): Promise<ActionResult> {
  if (scope !== "group" && scope !== "personal") return { error: "ประเภทเช็คลิสต์ไม่ถูกต้อง" };
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "พิมพ์รายการก่อนกดเพิ่ม" };
  if (clean.length > MAX_CHECKLIST_TEXT) return { error: `รายการยาวเกิน ${MAX_CHECKLIST_TEXT} ตัวอักษร` };
  const cat = String(category ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CHECKLIST_CATEGORY).trim() || CUSTOM_CATEGORY;
  return write(tripId, () =>
    apiFetch<ChecklistItem>(`${tripPath(tripId)}/checklist`, { method: "POST", json: { scope, text: clean, category: cat } }),
  );
}

/** B37 */
export async function removeChecklistItem(tripId: ID, itemId: ID): Promise<ActionResult> {
  return write(tripId, () => apiFetch<void>(itemPath(tripId, itemId), { method: "DELETE" }));
}
