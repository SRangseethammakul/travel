import { z } from "zod";

/** ฿20,000,000 in satang: keeps every amount inside int32 so the driver never writes a double. */
export const MAX_SATANG = 2_000_000_000;

export const Id = z.string().min(1).max(100);
export const Satang = z.int().min(0).max(MAX_SATANG);
export const PositiveSatang = z.int().min(1).max(MAX_SATANG);
export const ColorKey = z.enum(["teal", "blue", "orange", "purple", "slate", "gray", "ink"]);
export const AuthProvider = z.enum(["line", "google"]);
/** Calendar date `YYYY-MM-DD` that exists (rejects 2026-13-45, 2027-02-30). */
export const IsoDate = z.iso.date();
/** Local wall-clock `YYYY-MM-DDTHH:mm` on a date that exists. */
export const LocalDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/)
  .refine((s) => IsoDate.safeParse(s.slice(0, 10)).success);
/** Local time `HH:mm`. */
export const HHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const text = (max: number) => z.string().max(max);

export type ColorKey = z.infer<typeof ColorKey>;
