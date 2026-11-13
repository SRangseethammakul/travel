import { Router } from "express";
import {
  createPersonalExpense,
  getPersonalExpenses,
  removePersonalExpense,
  editPersonalExpense,
} from "../controllers/personal-expense.controller.js";

/**
 * Mounted at /api/trips/:tripId/personal-expenses behind requireUser + requireMember.
 * Any role; every query is scoped to the Current Member (`ownerId`).
 */
export const personalExpenseRoutes = Router();
personalExpenseRoutes.get("/", getPersonalExpenses);
personalExpenseRoutes.post("/", createPersonalExpense);
personalExpenseRoutes.patch("/:id", editPersonalExpense);
personalExpenseRoutes.delete("/:id", removePersonalExpense);
