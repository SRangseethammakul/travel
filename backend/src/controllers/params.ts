import type { Request } from "express";
import { HttpError } from "../errors.js";

/** A route param, or 404 when missing. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value === "") throw new HttpError(404, "not_found", "ไม่พบสิ่งที่ต้องการ");
  return value;
}
