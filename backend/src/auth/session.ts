import type { RequestHandler, Response } from "express";
import { findUserById } from "../models/user.model.js";
import type { UserDoc } from "../schemas/models.js";

/**
 * Session = signed cookie `<userId>.<sessionVersion>.<expiresAtMs>` (cookie-parser signs it with
 * SESSION_SECRET). Logout bumps `users.sessionVersion`, so a copied cookie stops working on the
 * server too (it signs the User out on every device). The expiry inside the value still bounds it.
 */
export const SESSION_COOKIE = "session";
const SESSION_MS = 30 * 86_400_000;

export function setSession(res: Response, user: UserDoc, secure: boolean): void {
  res.cookie(SESSION_COOKIE, `${user._id}.${user.sessionVersion ?? 0}.${Date.now() + SESSION_MS}`, {
    signed: true,
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_MS,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Sets `req.user` from a valid, unexpired session cookie whose version matches the User's. */
export const sessionUser: RequestHandler = async (req, _res, next) => {
  const value: unknown = req.signedCookies?.[SESSION_COOKIE];
  if (typeof value === "string") {
    const [userId, version, expiresAt, ...rest] = value.split(".");
    if (userId && rest.length === 0 && Number(expiresAt) > Date.now()) {
      const user = await findUserById(userId);
      if (user && String(user.sessionVersion ?? 0) === version) req.user = user;
    }
  }
  next();
};
