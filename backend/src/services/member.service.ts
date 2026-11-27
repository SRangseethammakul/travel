import { newId } from "../db/ids.js";
import { PALETTE } from "../domain/colors.js";
import { ROLE_LABEL } from "../domain/labels.js";
import { outstandingOf } from "../domain/money/trip.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { isMemberReferenced, loadBalanceInputs } from "../models/balance.model.js";
import { removeMemberFromChecklist } from "../models/checklist.model.js";
import { removeMemberPersonalExpenses } from "../models/personal-expense.model.js";
import {
  approveMember,
  countActiveOwners,
  deleteMember,
  deletePendingMember,
  findMemberAnyStatus,
  findTripMember,
  insertMembers,
  listTripMembers,
  revertPendingClaim,
  setMemberRole,
  softRemoveMember,
} from "../models/member.model.js";
import type { AddMemberInput } from "../schemas/member.inputs.js";
import type { MemberDoc } from "../schemas/models.js";
import type { z } from "zod";

const memberNotFound = () => new HttpError(404, "member_not_found", "ไม่พบสมาชิกคนนี้");
const notPending = () => new HttpError(409, "not_pending", "สมาชิกคนนี้ไม่ได้รออนุมัติ");

async function loadTarget(tripId: string, memberId: string): Promise<MemberDoc> {
  const member = await findTripMember(tripId, memberId);
  if (!member) throw memberNotFound();
  return member;
}

/** The last active owner can't be demoted or removed. */
async function assertNotLastOwner(target: MemberDoc): Promise<void> {
  if (target.role === "owner" && target.status === "active" && (await countActiveOwners(target.tripId)) <= 1) {
    throw new HttpError(409, "last_owner", "ทริปต้องมีผู้จัดทริปอย่างน้อย 1 คน");
  }
}

/** A4 */
export function list(tripId: string): Promise<MemberDoc[]> {
  return listTripMembers(tripId);
}

/** B4 — adds an Unclaimed Member. */
export async function add(me: MemberDoc, input: z.infer<typeof AddMemberInput>): Promise<MemberDoc> {
  const used = new Set((await listTripMembers(me.tripId)).map((m) => m.color));
  const member: MemberDoc = {
    _id: newId(),
    tripId: me.tripId,
    userId: null,
    displayName: input.displayName,
    role: input.role,
    status: "active",
    color: PALETTE.find((c) => !used.has(c)) ?? "gray",
    createdAt: new Date(),
  };
  await insertMembers([member]);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: member._id, text: `เพิ่ม ${member.displayName} เป็นสมาชิก` });
  return member;
}

/** B5 */
export async function changeRole(me: MemberDoc, memberId: string, role: MemberDoc["role"]): Promise<MemberDoc> {
  const target = await loadTarget(me.tripId, memberId);
  if (role !== "owner") await assertNotLastOwner(target);
  const updated = await setMemberRole(me.tripId, target._id, role);
  if (!updated) throw memberNotFound();
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "member",
    refId: target._id,
    text: `เปลี่ยนสิทธิ์ของ ${target.displayName} เป็น${ROLE_LABEL[role]}`,
  });
  return updated;
}

/**
 * B6, docs/db/schema.md §5.4: last owner → 409; Outstanding ≠ 0 → 409; still named by an
 * Expense/Settlement → soft remove; otherwise delete (and their personal checklist and Personal Expenses).
 */
export async function remove(me: MemberDoc, memberId: string): Promise<void> {
  const target = await loadTarget(me.tripId, memberId);
  await assertNotLastOwner(target);
  if (outstandingOf(await loadBalanceInputs(me.tripId), target._id) !== 0) {
    throw new HttpError(409, "outstanding_not_zero", "สมาชิกคนนี้ยังมียอดค้าง ต้องเคลียร์ก่อนนำออก");
  }
  if (await isMemberReferenced(me.tripId, target._id)) {
    await softRemoveMember(me.tripId, target._id);
  } else {
    await deleteMember(me.tripId, target._id);
    await removeMemberFromChecklist(me.tripId, target._id);
    await removeMemberPersonalExpenses(me.tripId, target._id);
  }
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: target._id, text: `นำ ${target.displayName} ออกจากทริป` });
}

/** B11 — pending → active. */
export async function approve(me: MemberDoc, memberId: string): Promise<MemberDoc> {
  const approved = await approveMember(me.tripId, memberId);
  if (!approved) {
    const existing = await findMemberAnyStatus(me.tripId, memberId);
    if (!existing || existing.status === "removed") throw memberNotFound();
    throw notPending();
  }
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: memberId, text: `อนุมัติ ${approved.displayName} เข้าร่วมทริป` });
  return approved;
}

/**
 * B11a — turn down a pending request. A pending Claim goes back to an Unclaimed Member (the name
 * stays claimable, its Expenses untouched); a pending newcomer is deleted. Either way their
 * personal checklist goes too. Returns the Unclaimed Member again, or null when deleted.
 */
export async function reject(me: MemberDoc, memberId: string): Promise<MemberDoc | null> {
  const existing = await findMemberAnyStatus(me.tripId, memberId);
  if (!existing || existing.status === "removed") throw memberNotFound();
  if (existing.status !== "pending") throw notPending();

  let member: MemberDoc | null = null;
  if (existing.claimedAt) {
    member = await revertPendingClaim(me.tripId, memberId);
    if (!member) throw notPending();
  } else if (!(await deletePendingMember(me.tripId, memberId))) {
    throw notPending();
  }
  await removeMemberFromChecklist(me.tripId, memberId);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: member ? memberId : null, text: `ปฏิเสธคำขอเข้าร่วมทริปของ ${existing.displayName}` });
  return member;
}
