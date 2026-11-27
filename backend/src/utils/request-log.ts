import type { RequestHandler } from "express";
import { insertRequestLog } from "../models/request-log.model.js";

/** Not worth logging: the health probe is noisy and admin reads would fill the log with themselves. */
export function shouldRecordRequest(path: string): boolean {
  // Express matches case-insensitively and ignores a trailing slash, so compare the same way.
  const p = path.toLowerCase().replace(/\/+$/, "");
  return p !== "/api/health" && p !== "/api/admin" && !p.startsWith("/api/admin/");
}

/** Must match the `path` maxLength in the requestLogs validator, or the insert is rejected. */
const MAX_PATH_LENGTH = 500;
const truncatePath = (path: string) => (path.length > MAX_PATH_LENGTH ? `${path.slice(0, MAX_PATH_LENGTH - 3)}…` : path);

/**
 * Stores one entry per finished request in the capped `requestLogs` collection for the admin
 * dashboard. Fire-and-forget: a failed write never touches the request. The query string is
 * left out (signed file URLs carry their token there).
 */
export const requestLogWriter: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const path = req.originalUrl.split("?", 1)[0] ?? "";
    if (!shouldRecordRequest(path)) return;
    insertRequestLog({
      at: new Date(),
      method: req.method,
      path: truncatePath(path),
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
      userId: req.user?._id ?? null,
    }).catch(() => undefined);
  });
  next();
};
