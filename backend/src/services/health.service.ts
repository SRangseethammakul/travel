import { HttpError } from "../errors.js";
import { pingDb } from "../models/health.model.js";

/** 503 when the database does not answer. */
export async function check(): Promise<void> {
  try {
    await pingDb();
  } catch {
    throw new HttpError(503, "db_unavailable", "ฐานข้อมูลไม่พร้อมใช้งาน");
  }
}
