import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import * as balances from "../services/balance.service.js";
import { balancesView, summaryView } from "../views/balance.view.js";

/** A14 */
export const getBalances: RequestHandler = async (req, res) => {
  res.json(balancesView(await balances.loadVisibleBalances(currentMember(req))));
};

/** Summary page: A14 + `byCategory` + per-Member `items` (ที่มา). */
export const getSummary: RequestHandler = async (req, res) => {
  res.json(summaryView(await balances.loadVisibleBalances(currentMember(req))));
};
