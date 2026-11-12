import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { listActivity, markRead } from "../controllers/activity.controller.js";
import { getBalances, getSummary } from "../controllers/balance.controller.js";
import { createExpense, getExpense, listExpenses, patchExpense, removeExpense } from "../controllers/expense.controller.js";
import { confirmSettlement, listSettlements, replaceSlip, reportSettlement } from "../controllers/settlement.controller.js";

const editors = requireRole("owner", "editor");

/** Mounted at /api/trips/:tripId/expenses. Edit/delete: owner, or the editor who created it (checked in the controller). */
export const expenseRoutes = Router();
expenseRoutes.get("/", listExpenses);
expenseRoutes.post("/", editors, createExpense);
expenseRoutes.get("/:expenseId", getExpense);
expenseRoutes.patch("/:expenseId", editors, patchExpense);
expenseRoutes.delete("/:expenseId", editors, removeExpense);

/** Mounted at /api/trips/:tripId/settlements. Any role; sender/receiver checked in the conditional update. */
export const settlementRoutes = Router();
settlementRoutes.get("/", listSettlements);
settlementRoutes.post("/", reportSettlement);
settlementRoutes.post("/:settlementId/confirm", confirmSettlement);
settlementRoutes.post("/:settlementId/slip", replaceSlip);

/** Mounted at /api/trips/:tripId/balances and /summary. Any Member. */
export const balanceRoutes = Router();
balanceRoutes.get("/", getBalances);
export const summaryRoutes = Router();
summaryRoutes.get("/", getSummary);

/** Mounted at /api/trips/:tripId/activity. Any Member. */
export const activityRoutes = Router();
activityRoutes.get("/", listActivity);
activityRoutes.post("/read", markRead);
