import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { PersonalExpenseCreateBody, PersonalExpenseUpdateBody } from "../schemas/personal-expense.inputs.js";
import * as personal from "../services/personal-expense.service.js";
import { personalExpenseView } from "../views/personal-expense.view.js";
import { param } from "./params.js";

/** B44 GET /api/trips/:tripId/personal-expenses — my records only. */
export const getPersonalExpenses: RequestHandler = async (req, res) => {
  res.json((await personal.list(currentMember(req))).map(personalExpenseView));
};

/** B45 POST — any role; owner = me. */
export const createPersonalExpense: RequestHandler = async (req, res) => {
  const doc = await personal.create(currentMember(req), PersonalExpenseCreateBody.parse(req.body));
  res.status(201).json(personalExpenseView(doc));
};

/** B46 PATCH /:id — only my own record. */
export const editPersonalExpense: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const patch = PersonalExpenseUpdateBody.parse(req.body);
  res.json(personalExpenseView(await personal.edit(me, param(req, "id"), patch)));
};

/** B47 DELETE /:id — only my own record. */
export const removePersonalExpense: RequestHandler = async (req, res) => {
  await personal.remove(currentMember(req), param(req, "id"));
  res.status(204).end();
};
