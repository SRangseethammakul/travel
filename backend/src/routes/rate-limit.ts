import type { Request, Response } from "express";
import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { currentUser } from "../auth/middleware.js";
import type { Config } from "../config/config.js";

const WINDOW_MS = 15 * 60_000;
const LIMIT = 30;

/** express-rate-limit handler that answers in the API error shape. */
export function rateLimited(_req: Request, res: Response): void {
  res.status(429).json({ error: { code: "rate_limited", message: "ส่งคำขอบ่อยเกินไป ลองใหม่อีกครั้งในภายหลัง" } });
}

/**
 * Per IP, for routes with no signed-in User (OAuth start / callback). `req.ip` is only the real
 * client when `TRUST_PROXY` matches the proxies in front (see config.ts). The "X-Forwarded-For
 * without trust proxy" warning is kept in production — there it means every client shares one IP.
 */
export function ipLimiter(config: Config): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: LIMIT,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimited,
    validate: { xForwardedForHeader: config.NODE_ENV === "production" },
  });
}

/**
 * Per signed-in User — does not depend on proxies or IPs. Mount only after `requireUser`
 * (currentUser throws 401 otherwise).
 */
export function userLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: LIMIT,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimited,
    keyGenerator: (req) => `user:${String(currentUser(req)._id)}`,
  });
}
