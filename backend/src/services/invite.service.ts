import { randomBytes } from "node:crypto";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { findInviteByTrip, resetInviteToken, upsertInvite } from "../models/invite.model.js";
import type { InviteInput } from "../schemas/member.inputs.js";
import type { InviteDoc, MemberDoc } from "../schemas/models.js";
import type { z } from "zod";

/** 192 random bits, URL-safe (32 chars). */
const newToken = () => randomBytes(24).toString("base64url");

const DAY_MS = 86_400_000;
const EXPIRES_IN_MS = { "1d": DAY_MS, "7d": 7 * DAY_MS, never: null } as const;

/** A5 → Invite | null */
export function get(tripId: string): Promise<InviteDoc | null> {
  return findInviteByTrip(tripId);
}

/** B7 — expiry 1 day / 7 days / never, approval. */
export async function set(me: MemberDoc, input: z.infer<typeof InviteInput>): Promise<InviteDoc> {
  const ms = EXPIRES_IN_MS[input.expiresIn];
  const invite = await upsertInvite(
    me.tripId,
    { expiresAt: ms === null ? null : new Date(Date.now() + ms), requireApproval: input.requireApproval },
    newToken(),
  );
  if (!invite) throw new Error("upsert returned no invite");
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: null, text: "ตั้งค่าลิงก์เชิญ" });
  return invite;
}

/** B8 — new token; the old link stops working. */
export async function reset(me: MemberDoc): Promise<InviteDoc> {
  const invite = await resetInviteToken(me.tripId, newToken());
  if (!invite) throw new HttpError(404, "invite_not_found", "ยังไม่มีลิงก์เชิญ");
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: null, text: "รีเซ็ตลิงก์เชิญ" });
  return invite;
}
