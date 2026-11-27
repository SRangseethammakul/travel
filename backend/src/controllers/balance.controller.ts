import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { loadAvatars } from "../utils/member-avatars.js";
import * as balances from "../services/balance.service.js";
import { balancesView, summaryView } from "../views/balance.view.js";

/** A14 */
export const getBalances: RequestHandler = async (req, res) => {
  const data = await balances.loadVisibleBalances(currentMember(req));
  res.json(balancesView({ ...data, avatars: await loadAvatars(data.members) }));
};

/** Summary page: A14 + `byCategory` + per-Member `items` (ที่มา). */
export const getSummary: RequestHandler = async (req, res) => {
  const data = await balances.loadVisibleBalances(currentMember(req));
  res.json(summaryView({ ...data, avatars: await loadAvatars(data.members) }));
};
