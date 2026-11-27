import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { CreateChecklistInput, SuggestionsQuery, UpdateChecklistInput } from "../schemas/checklist.inputs.js";
import * as checklist from "../services/checklist.service.js";
import { checklistItemView } from "../views/checklist.view.js";
import { param } from "./params.js";

/** A15 GET /api/trips/:tripId/checklist — group items + my personal items only. */
export const getChecklist: RequestHandler = async (req, res) => {
  res.json((await checklist.list(currentMember(req))).map(checklistItemView));
};

/** B35 POST — personal: any Member (owner = me); group: owner/editor. */
export const createChecklistItem: RequestHandler = async (req, res) => {
  const item = await checklist.create(currentMember(req), CreateChecklistInput.parse(req.body));
  res.status(201).json(checklistItemView(item));
};

/** B36 PATCH — group: any Member may tick or assign; personal: only its owner. */
export const updateChecklist: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const patch = UpdateChecklistInput.parse(req.body);
  res.json(checklistItemView(await checklist.update(me, param(req, "itemId"), patch)));
};

/** B37 DELETE — group: owner/editor; personal: its owner. */
export const removeChecklistItem: RequestHandler = async (req, res) => {
  await checklist.remove(currentMember(req), param(req, "itemId"));
  res.status(204).end();
};

/** B38 GET /api/checklist/suggestions?scope= — static list. */
export const getSuggestions: RequestHandler = (req, res) => {
  const { scope } = SuggestionsQuery.parse(req.query);
  res.json(checklist.getSuggestions(scope));
};
