import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

/** Thrown by controllers/middleware; rendered as `{ error: { code, message } }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = () => {
  throw new HttpError(404, "not_found", "ไม่พบสิ่งที่ต้องการ");
};

function hasStatus(err: unknown): err is { status: number } {
  return typeof err === "object" && err !== null && typeof (err as { status?: unknown }).status === "number";
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "invalid_input", message: "ข้อมูลไม่ถูกต้อง" } });
    return;
  }
  // body-parser errors (malformed JSON, too large) carry a 4xx `status`.
  if (hasStatus(err) && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: { code: "bad_request", message: "คำขอไม่ถูกต้อง" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "internal", message: "เกิดข้อผิดพลาด" } });
};
