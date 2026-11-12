import type { RequestHandler } from "express";
import { currentUser } from "../auth/middleware.js";
import { userView } from "../views/user.view.js";

/** A1 GET /api/me */
export const getMe: RequestHandler = (req, res) => {
  res.json(userView(currentUser(req)));
};
