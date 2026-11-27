import type { Request, RequestHandler } from "express";
import type { Config } from "../config/config.js";
import { HttpError } from "../errors.js";
import { findActiveMember } from "../models/member.model.js";
import { findUserById } from "../models/user.model.js";
import { touchLastSeen } from "./session.js";
import type { MemberDoc, Role, UserDoc } from "../schemas/models.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Signed-in User, set by `mockUser` (dev/test) or the session (phase 5). */
    user?: UserDoc;
    /** Current Member of `:tripId`, set by `requireMember`. */
    member?: MemberDoc;
  }
}

export const MOCK_USER_COOKIE = "mock-user";

/**
 * dev/test only: the `mock-user` cookie holds a User id (`act`, `mint`, …).
 * In production this middleware is not mounted at all.
 */
export function mockUser(nodeEnv: Config["NODE_ENV"]): RequestHandler {
  if (nodeEnv === "production") throw new Error("mock-user must never be enabled in production");
  return async (req, _res, next) => {
    const userId: unknown = req.cookies?.[MOCK_USER_COOKIE];
    if (!req.user && typeof userId === "string" && userId) {
      req.user = (await findUserById(userId)) ?? undefined;
      if (req.user) void touchLastSeen(req.user);
    }
    next();
  };
}

/** 401 unless a User is signed in. */
export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "unauthenticated", "กรุณาเข้าสู่ระบบ");
  next();
};

/** 404 (never 403, so the admin area is not revealed) unless the signed-in User is listed in ADMIN_USER_IDS. Mount after `requireUser`. */
export function requireAdmin(adminIds: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (!adminIds.includes(currentUser(req)._id)) throw new HttpError(404, "not_found", "ไม่พบหน้านี้");
    next();
  };
}

/** 404 unless the User is an active Member of `:tripId` — never reveal that the trip exists. */
export const requireMember: RequestHandler = async (req, _res, next) => {
  const user = currentUser(req);
  const tripId = req.params.tripId;
  const member = typeof tripId === "string" ? await findActiveMember(user._id, tripId) : null;
  if (!member) throw new HttpError(404, "trip_not_found", "ไม่พบทริปนี้");
  req.member = member;
  next();
};

/** 403 unless the Current Member has one of `roles`. Mount after `requireMember`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(currentMember(req).role)) {
      throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
    }
    next();
  };
}

export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new HttpError(401, "unauthenticated", "กรุณาเข้าสู่ระบบ");
  return req.user;
}

export function currentMember(req: Request): MemberDoc {
  if (!req.member) throw new Error("requireMember must run before currentMember()");
  return req.member;
}
