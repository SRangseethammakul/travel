import type { RequestHandler } from "express";
import { z } from "zod";
import { MOCK_USER_COOKIE } from "../auth/middleware.js";
import { HttpError } from "../errors.js";
import { findUserById, listUsers } from "../models/user.model.js";
import { Id } from "../schemas/common.js";
import { userView } from "../views/user.view.js";

/** A17 GET /api/dev/users — the dev User switcher (not mounted in production). */
export const devListUsers: RequestHandler = async (_req, res) => {
  res.json((await listUsers()).map(userView));
};

/** B43 POST /api/dev/login `{ userId }` — sets the `mock-user` cookie (not mounted in production). */
export const devLogin: RequestHandler = async (req, res) => {
  const { userId } = z.strictObject({ userId: Id }).parse(req.body);
  if (!(await findUserById(userId))) throw new HttpError(404, "user_not_found", "ไม่พบผู้ใช้");
  res.cookie(MOCK_USER_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  res.status(204).end();
};
