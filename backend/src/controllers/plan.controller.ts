import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { HopBody, TransitCreateBody, TransitUpdateBody, VisitCreateBody, VisitUpdateBody } from "../schemas/plan.js";
import * as plan from "../services/plan.service.js";
import { planItemView } from "../views/plan.view.js";
import { param } from "./params.js";

/** A10 — day, then time (untimed last), then insertion order. */
export const listPlan: RequestHandler = async (req, res) => {
  res.json((await plan.list(currentMember(req).tripId)).map(planItemView));
};

/** B24 — editor+. One Place on several days in one call. */
export const addVisits: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const items = await plan.addVisits(me, VisitCreateBody.parse(req.body));
  res.status(201).json(items.map(planItemView));
};

/** B25 — editor+. */
export const addTransit: RequestHandler = async (req, res) => {
  const item = await plan.addTransit(currentMember(req), TransitCreateBody.parse(req.body));
  res.status(201).json(planItemView(item));
};

/** B26 — owner, or the editor who added it. */
export const patchPlanItem: RequestHandler = async (req, res) => {
  const item = await plan.patchItem(currentMember(req), param(req, "itemId"), {
    visit: () => VisitUpdateBody.parse(req.body),
    transit: () => TransitUpdateBody.parse(req.body),
  });
  res.json(planItemView(item));
};

/** B27 — owner, or the editor who added the item. Sets the Hop to the next item. */
export const putHop: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const hop = HopBody.parse(req.body);
  res.json(planItemView(await plan.putHop(me, param(req, "itemId"), hop)));
};

/** B27 — owner, or the editor who added the item. Removes the Hop. */
export const deleteHop: RequestHandler = async (req, res) => {
  res.json(planItemView(await plan.deleteHop(currentMember(req), param(req, "itemId"))));
};

/** B28 — owner, or the editor who added it. */
export const removePlanItem: RequestHandler = async (req, res) => {
  await plan.remove(currentMember(req), param(req, "itemId"));
  res.status(204).end();
};
