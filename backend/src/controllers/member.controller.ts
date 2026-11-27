import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { AddMemberInput, ChangeRoleInput } from "../schemas/member.inputs.js";
import * as members from "../services/member.service.js";
import { loadAvatars } from "../utils/member-avatars.js";
import { memberView } from "../views/member.view.js";
import { param } from "./params.js";

/** A4 GET /api/trips/:tripId/members */
export const listMembers: RequestHandler = async (req, res) => {
  const list = await members.list(currentMember(req).tripId);
  const avatars = await loadAvatars(list);
  res.json(list.map((m) => memberView(m, avatars)));
};

/** B4 POST /api/trips/:tripId/members (owner) — adds an Unclaimed Member. */
export const addMember: RequestHandler = async (req, res) => {
  const member = await members.add(currentMember(req), AddMemberInput.parse(req.body));
  res.status(201).json(memberView(member, await loadAvatars([member])));
};

/** B5 PATCH /api/trips/:tripId/members/:memberId (owner) — change role. */
export const changeRole: RequestHandler = async (req, res) => {
  const { role } = ChangeRoleInput.parse(req.body);
  const member = await members.changeRole(currentMember(req), param(req, "memberId"), role);
  res.json(memberView(member, await loadAvatars([member])));
};

/** B6 DELETE /api/trips/:tripId/members/:memberId (owner). */
export const removeMember: RequestHandler = async (req, res) => {
  await members.remove(currentMember(req), param(req, "memberId"));
  res.status(204).end();
};

/** B11 POST /api/trips/:tripId/members/:memberId/approve (owner) — pending → active. */
export const approve: RequestHandler = async (req, res) => {
  const member = await members.approve(currentMember(req), param(req, "memberId"));
  res.json(memberView(member, await loadAvatars([member])));
};

/** B11a POST /api/trips/:tripId/members/:memberId/reject (owner) → `{ member: Member | null }`. */
export const reject: RequestHandler = async (req, res) => {
  const member = await members.reject(currentMember(req), param(req, "memberId"));
  res.json({ member: member ? memberView(member, await loadAvatars([member])) : null });
};
