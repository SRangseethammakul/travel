import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { findInviteByTrip, resetInviteToken, upsertInvite } from "../models/invite.model.js";
import { InviteInput } from "../schemas/member.inputs.js";
import { inviteView } from "../views/invite.view.js";

/** 192 random bits, URL-safe (32 chars). */
const newToken = () => randomBytes(24).toString("base64url");

const DAY_MS = 86_400_000;
const EXPIRES_IN_MS = { "1d": DAY_MS, "7d": 7 * DAY_MS, never: null } as const;

/** A5 GET /api/trips/:tripId/invite (owner) → Invite | null */
export const getInvite: RequestHandler = async (req, res) => {
  const invite = await findInviteByTrip(currentMember(req).tripId);
  res.json(invite ? inviteView(invite) : null);
};

/** B7 PUT /api/trips/:tripId/invite (owner) — expiry 1 day / 7 days / never, approval. */
export const setInvite: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const input = InviteInput.parse(req.body);
  const ms = EXPIRES_IN_MS[input.expiresIn];
  const invite = await upsertInvite(
    me.tripId,
    { expiresAt: ms === null ? null : new Date(Date.now() + ms), requireApproval: input.requireApproval },
    newToken(),
  );
  if (!invite) throw new Error("upsert returned no invite");
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: null, text: "ตั้งค่าลิงก์เชิญ" });
  res.json(inviteView(invite));
};

/** B8 POST /api/trips/:tripId/invite/reset (owner) — new token; the old link stops working. */
export const resetInvite: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const invite = await resetInviteToken(me.tripId, newToken());
  if (!invite) throw new HttpError(404, "invite_not_found", "ยังไม่มีลิงก์เชิญ");
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "member", refId: null, text: "รีเซ็ตลิงก์เชิญ" });
  res.json(inviteView(invite));
};
