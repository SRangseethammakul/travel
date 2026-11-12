import type { RequestHandler } from "express";
import { HttpError } from "../errors.js";
import { pingDb } from "../models/health.model.js";

export const getHealth: RequestHandler = async (_req, res) => {
  try {
    await pingDb();
  } catch {
    throw new HttpError(503, "db_unavailable", "ฐานข้อมูลไม่พร้อมใช้งาน");
  }
  res.json({ ok: true });
};
