import type { RequestHandler } from "express";
import winston from "winston";
import { redactPath } from "./redact-path.js";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const env = process.env.NODE_ENV;
const LEVELS = ["error", "warn", "info", "http", "verbose", "debug", "silly"];
const level = LEVELS.includes(process.env.LOG_LEVEL ?? "") ? process.env.LOG_LEVEL! : env === "production" ? "info" : "debug";

/** Dev: one readable line per entry, extra fields as JSON, stack on its own lines. */
const pretty = printf(({ timestamp, level, message, stack, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${String(timestamp)} ${level}: ${String(message)}${extra}${stack ? `\n${String(stack)}` : ""}`;
});

/**
 * App-wide logger. JSON lines in production (for the log collector), colored lines in dev.
 * Quiet under tests unless LOG_LEVEL is set. Level: LOG_LEVEL, else info (prod) / debug (dev).
 */
export const logger = winston.createLogger({
  level,
  silent: env === "test" && !process.env.LOG_LEVEL,
  format: combine(errors({ stack: true }), timestamp(), env === "production" ? json() : combine(colorize(), pretty)),
  transports: [new winston.transports.Console({ stderrLevels: ["error"] })],
});

/** Logs one `http` line per request when the response finishes. The query string is left out (signed file URLs carry their token there) and invite tokens are redacted. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const path = redactPath(req.originalUrl);
    logger.http(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms`, {
      method: req.method,
      path,
      status: res.statusCode,
      ms: Math.round(ms),
      userId: req.user?._id?.toString(),
    });
  });
  next();
};
