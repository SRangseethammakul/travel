import { Router } from "express";
import type { Config } from "../config.js";
import { authController } from "../controllers/auth.controller.js";
import { ipLimiter } from "./rate-limit.js";

/**
 * Mounted at /api/auth. OAuth start / callback are rate limited per IP. Logout is not limited:
 * it is idempotent, answers 204 even signed out, and a shared limit there would let one client
 * (or every request arriving from the Next server's IP) lock everyone out.
 */
export function authRoutes(config: Config) {
  const c = authController(config);
  const router = Router();
  const limiter = ipLimiter(config);
  router.post("/logout", c.logout);
  router.get("/:provider", limiter, c.start);
  router.get("/:provider/callback", limiter, c.callback);
  return router;
}
