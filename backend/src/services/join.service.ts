import { isDuplicateKeyError, newId } from "../db/ids.js";
import { PROVIDER_LABEL } from "../domain/labels.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { loadBalanceInputs } from "../models/balance.model.js";
import { insertTemplateItems } from "../models/checklist.model.js";
import { findInviteByToken } from "../models/invite.model.js";
import { claimMember, findMemberAnyStatus, insertMembers, listUnclaimedMembers } from "../models/member.model.js";
import { findTripById } from "../models/trip.model.js";
import type { JoinInput } from "../schemas/member.inputs.js";
import type { InviteDoc, MemberDoc, TripDoc, UserDoc } from "../schemas/models.js";
import type { z } from "zod";

const alreadyMember = () => new HttpError(409, "already_member", "คุณเป็นสมาชิกทริปนี้อยู่แล้ว");

/** Valid invite for the token: unknown → 404, expired → 410. */
async function loadInvite(token: string): Promise<InviteDoc> {
  const invite = await findInviteByToken(token);
  if (!invite) throw new HttpError(404, "invite_not_found", "ไม่พบลิงก์เชิญนี้");
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, "invite_expired", "ลิงก์เชิญหมดอายุแล้ว");
  }
  return invite;
}

export interface JoinPreview {
  trip: TripDoc;
  requireApproval: boolean;
  members: { member: MemberDoc; expenseCount: number; total: number }[];
}

/**
 * B9 — trip preview and the Unclaimed Members to choose from, each with how many Expenses name
 * them and the sum of their Shares.
 */
export async function preview(token: string): Promise<JoinPreview> {
  const invite = await loadInvite(token);
  const trip = await findTripById(invite.tripId);
  if (!trip) throw new HttpError(404, "invite_not_found", "ไม่พบลิงก์เชิญนี้");
  const [unclaimed, { expenses }] = await Promise.all([listUnclaimedMembers(trip._id), loadBalanceInputs(trip._id)]);
  return {
    trip,
    requireApproval: invite.requireApproval,
    members: unclaimed.map((m) => {
      const linked = expenses.filter((e) => e.payerId === m._id || e.shares.some((s) => s.memberId === m._id));
      const total = linked.reduce((sum, e) => sum + e.shares.filter((s) => s.memberId === m._id).reduce((a, s) => a + s.amount, 0), 0);
      return { member: m, expenseCount: linked.length, total };
    }),
  };
}

/**
 * B10 — `{ claimMemberId }` Claims an Unclaimed Member (one conditional update on that Member; a
 * second claimer gets 409), or `{ displayName }` adds the User as a new Member. With
 * `requireApproval` the Member is `pending` until the owner approves.
 * `parseInput` runs after the invite is checked, so an unknown/expired token answers before a bad body.
 */
export async function join(user: UserDoc, token: string, parseInput: () => z.infer<typeof JoinInput>): Promise<{ tripId: string; member: MemberDoc; pending: boolean }> {
  const invite = await loadInvite(token);
  const input = parseInput();
  const tripId = invite.tripId;
  const status = invite.requireApproval ? "pending" : "active";
  let member: MemberDoc;

  try {
    if ("claimMemberId" in input) {
      const claimed = await claimMember(tripId, input.claimMemberId, user, status);
      if (!claimed) {
        const existing = await findMemberAnyStatus(tripId, input.claimMemberId);
        if (!existing || existing.status === "removed") throw new HttpError(404, "member_not_found", "ไม่พบชื่อนี้ในทริป");
        throw new HttpError(409, "already_claimed", "มีคนเลือกชื่อนี้ไปแล้ว");
      }
      member = claimed;
    } else {
      member = {
        _id: newId(),
        tripId,
        userId: user._id,
        displayName: input.displayName,
        role: "editor",
        status,
        joinedVia: user.provider,
        color: user.color,
        createdAt: new Date(),
      };
      await insertMembers([member]);
    }
  } catch (err) {
    if (isDuplicateKeyError(err)) throw alreadyMember();
    throw err;
  }

  await insertTemplateItems(tripId, { group: false, personalFor: member._id });
  const how = `ผ่าน ${PROVIDER_LABEL[user.provider]}`;
  await addActivity({
    tripId,
    actorId: member._id,
    type: "member",
    refId: member._id,
    text: status === "pending" ? `ขอเข้าร่วมทริป${how} รออนุมัติ` : `เข้าร่วมทริป${how}`,
  });
  return { tripId, member, pending: status === "pending" };
}
