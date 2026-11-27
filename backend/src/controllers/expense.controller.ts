import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { ExpenseCreateBody, ExpenseUpdateBody } from "../schemas/money.js";
import * as expenses from "../services/expense.service.js";
import { expenseView } from "../views/expense.view.js";
import { param } from "./params.js";

/** A11 — every role sees all Expenses of the trip. */
export const listExpenses: RequestHandler = async (req, res) => {
  res.json((await expenses.list(currentMember(req).tripId)).map(expenseView));
};

/** A12 */
export const getExpense: RequestHandler = async (req, res) => {
  res.json(expenseView(await expenses.get(currentMember(req).tripId, param(req, "expenseId"))));
};

/** B29 — editor+. */
export const createExpense: RequestHandler = async (req, res) => {
  const expense = await expenses.create(currentMember(req), ExpenseCreateBody.parse(req.body));
  res.status(201).json(expenseView(expense));
};

/** B30 — owner, or the editor who created it. */
export const patchExpense: RequestHandler = async (req, res) => {
  const expense = await expenses.patch(currentMember(req), param(req, "expenseId"), () => ExpenseUpdateBody.parse(req.body));
  res.json(expenseView(expense));
};

/** B31 — owner, or the editor who created it. */
export const removeExpense: RequestHandler = async (req, res) => {
  await expenses.remove(currentMember(req), param(req, "expenseId"));
  res.status(204).end();
};
