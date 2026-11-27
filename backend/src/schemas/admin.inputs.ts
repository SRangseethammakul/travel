import { z } from "zod";

/** Empty `?q=` means no search. */
const q = z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().min(1).max(100).optional());
const page = z.coerce.number().int().min(1).max(100_000).default(1);
const direction = z.enum(["asc", "desc"]);

export const AdminOverviewQuery = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(30),
});

export const AdminUsersQuery = z.object({
  q,
  provider: z.enum(["google", "line"]).optional(),
  sort: z.enum(["createdAt", "lastSeenAt", "name"]).default("createdAt"),
  dir: direction.default("desc"),
  page,
});

export const AdminTripsQuery = z.object({
  q,
  status: z.enum(["upcoming", "ongoing", "past"]).optional(),
  sort: z.enum(["startDate", "createdAt"]).default("startDate"),
  dir: direction.default("desc"),
  page,
});

export const AdminSystemQuery = z.object({
  filter: z.enum(["all", "4xx", "5xx", "slow"]).default("all"),
  page,
});

export type AdminUsersQuery = z.infer<typeof AdminUsersQuery>;
export type AdminTripsQuery = z.infer<typeof AdminTripsQuery>;
export type AdminSystemQuery = z.infer<typeof AdminSystemQuery>;
