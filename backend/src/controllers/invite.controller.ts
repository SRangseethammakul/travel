import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { InviteInput } from "../schemas/member.inputs.js";
import * as invites from "../services/invite.service.js";
import { inviteView } from "../views/invite.view.js";

/** A5 GET /api/trips/:tripId/invite (owner) → Invite | null */
export const getInvite: RequestHandler = async (req, res) => {
  const invite = await invites.get(currentMember(req).tripId);
  res.json(invite ? inviteView(invite) : null);
};

/** B7 PUT /api/trips/:tripId/invite (owner) — expiry 1 day / 7 days / never, approval. */
export const setInvite: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  res.json(inviteView(await invites.set(me, InviteInput.parse(req.body))));
};

/** B8 POST /api/trips/:tripId/invite/reset (owner) — new token; the old link stops working. */
export const resetInvite: RequestHandler = async (req, res) => {
  res.json(inviteView(await invites.reset(currentMember(req))));
};
