import { newId } from "../db/ids.js";
import { SUGGESTIONS } from "../domain/checklist.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import {
  deleteChecklistItem,
  findVisibleChecklistItem,
  insertChecklistItem,
  listChecklist,
  updateChecklistItem,
} from "../models/checklist.model.js";
import { findActiveTripMember } from "../models/member.model.js";
import type { CreateChecklistInput, SuggestionsQuery, UpdateChecklistInput } from "../schemas/checklist.inputs.js";
import type { ChecklistItemDoc, MemberDoc } from "../schemas/models.js";
import type { z } from "zod";

const canEditGroup = (me: MemberDoc) => me.role === "owner" || me.role === "editor";
const forbidden = () => new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");

async function assertAssignee(tripId: string, assigneeId: string): Promise<void> {
  if (!(await findActiveTripMember(tripId, assigneeId))) throw new HttpError(400, "invalid_assignee", "ไม่พบสมาชิกที่เลือก");
}

/** Item the Current Member can see; others' personal items are 404 (filtered in the query). */
async function loadVisible(me: MemberDoc, itemId: string): Promise<ChecklistItemDoc> {
  const item = await findVisibleChecklistItem(me.tripId, me._id, itemId);
  if (!item) throw new HttpError(404, "checklist_item_not_found", "ไม่พบรายการนี้");
  return item;
}

/** Personal items are private, so only group changes are written to the shared Activity feed. */
async function groupActivity(me: MemberDoc, item: ChecklistItemDoc, text: string): Promise<void> {
  if (item.scope === "group") await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: item._id, text });
}

/** A15 — group items + my personal items only. */
export function list(me: MemberDoc): Promise<ChecklistItemDoc[]> {
  return listChecklist(me.tripId, me._id);
}

/** B35 — personal: any Member (owner = me); group: owner/editor. */
export async function create(me: MemberDoc, input: z.infer<typeof CreateChecklistInput>): Promise<ChecklistItemDoc> {
  if (input.scope === "group" && !canEditGroup(me)) throw forbidden();
  if (input.scope === "personal" && input.assigneeId) throw new HttpError(400, "invalid_assignee", "รายการส่วนตัวไม่มีคนรับผิดชอบ");
  if (input.assigneeId) await assertAssignee(me.tripId, input.assigneeId);
  const item: ChecklistItemDoc = {
    _id: newId(),
    tripId: me.tripId,
    scope: input.scope,
    ...(input.scope === "personal" ? { ownerId: me._id } : {}),
    text: input.text,
    category: input.category,
    ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
    done: false,
    fromTemplate: false,
    createdAt: new Date(),
  };
  await insertChecklistItem(item);
  await groupActivity(me, item, `เพิ่มรายการเช็คลิสต์ "${item.text}"`);
  return item;
}

/**
 * B36 — group: any Member may tick or assign, owner/editor may also edit the text;
 * personal: only its owner (others get 404). `doneBy` is set by the server.
 */
export async function update(me: MemberDoc, itemId: string, patch: z.infer<typeof UpdateChecklistInput>): Promise<ChecklistItemDoc> {
  const item = await loadVisible(me, itemId);
  if (item.scope === "group" && (patch.text !== undefined || patch.category !== undefined) && !canEditGroup(me)) throw forbidden();
  if (item.scope === "personal" && patch.assigneeId) throw new HttpError(400, "invalid_assignee", "รายการส่วนตัวไม่มีคนรับผิดชอบ");
  if (patch.assigneeId) await assertAssignee(me.tripId, patch.assigneeId);

  const $set: Partial<ChecklistItemDoc> = {};
  const $unset: Partial<Record<"assigneeId" | "doneBy", "">> = {};
  if (patch.text !== undefined) $set.text = patch.text;
  if (patch.category !== undefined) $set.category = patch.category;
  if (patch.assigneeId === null) $unset.assigneeId = "";
  else if (patch.assigneeId !== undefined) $set.assigneeId = patch.assigneeId;
  if (patch.done === true) Object.assign($set, { done: true, doneBy: me._id });
  if (patch.done === false) {
    $set.done = false;
    $unset.doneBy = "";
  }
  const updated = await updateChecklistItem(me.tripId, item._id, {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  });
  if (!updated) throw new HttpError(404, "checklist_item_not_found", "ไม่พบรายการนี้");
  const text =
    patch.done === true ? `ทำ "${item.text}" เสร็จแล้ว` : patch.done === false ? `ยกเลิกเสร็จ "${item.text}"` : `แก้ไขรายการเช็คลิสต์ "${updated.text}"`;
  await groupActivity(me, item, text);
  return updated;
}

/** B37 — group: owner/editor; personal: its owner. */
export async function remove(me: MemberDoc, itemId: string): Promise<void> {
  const item = await loadVisible(me, itemId);
  if (item.scope === "group" && !canEditGroup(me)) throw forbidden();
  await deleteChecklistItem(me.tripId, item._id);
  await groupActivity(me, item, `ลบรายการเช็คลิสต์ "${item.text}"`);
}

/** B38 — static list. */
export function getSuggestions(scope: z.infer<typeof SuggestionsQuery>["scope"]) {
  return SUGGESTIONS[scope];
}
