import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { SettlementCreateBody, SlipBody } from "../schemas/money.js";
import * as settlements from "../services/settlement.service.js";
import { settlementView } from "../views/settlement.view.js";
import { param } from "./params.js";

/** A13 — every role sees all Settlements of the trip. */
export const listSettlements: RequestHandler = async (req, res) => {
  res.json((await settlements.list(currentMember(req).tripId)).map(settlementView));
};

/** B32 — any role, viewers included: the Current Member reports a transfer they made. */
export const reportSettlement: RequestHandler = async (req, res) => {
  const settlement = await settlements.report(currentMember(req), SettlementCreateBody.parse(req.body));
  res.status(201).json(settlementView(settlement));
};

/** B33 — receiver only: sent → confirmed. */
export const confirmSettlement: RequestHandler = async (req, res) => {
  res.json(settlementView(await settlements.confirm(currentMember(req), param(req, "settlementId"))));
};

/** B34 — sender only, while still sent: attach or replace the slip. */
export const replaceSlip: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const id = param(req, "settlementId");
  const { slipDocId } = SlipBody.parse(req.body);
  res.json(settlementView(await settlements.replaceSlip(me, id, slipDocId)));
};
