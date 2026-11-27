import type { RequestHandler } from "express";
import { currentUser } from "../auth/middleware.js";
import { JoinInput } from "../schemas/member.inputs.js";
import * as joins from "../services/join.service.js";
import { loadAvatars } from "../utils/member-avatars.js";
import { memberView } from "../views/member.view.js";
import { param } from "./params.js";

/** B9 GET /api/join/:token (public) — trip preview and the Unclaimed Members to choose from. */
export const previewJoin: RequestHandler = async (req, res) => {
  const { trip, requireApproval, members } = await joins.preview(param(req, "token"));
  const avatars = await loadAvatars(members.map((m) => m.member));
  res.json({
    trip: { name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, cover: trip.cover },
    requireApproval,
    members: members.map((m) => ({ member: memberView(m.member, avatars), expenseCount: m.expenseCount, total: m.total })),
  });
};

/** B10 POST /api/join/:token — `{ claimMemberId }` Claims an Unclaimed Member, or `{ displayName }` adds a new one. */
export const join: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { tripId, member, pending } = await joins.join(user, param(req, "token"), () => JoinInput.parse(req.body));
  res.json({ tripId, member: memberView(member, await loadAvatars([member])), pending });
};
