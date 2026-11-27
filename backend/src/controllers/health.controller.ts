import type { RequestHandler } from "express";
import * as health from "../services/health.service.js";

export const getHealth: RequestHandler = async (_req, res) => {
  await health.check();
  res.json({ ok: true });
};
