/**
 * Small additions on top of src/test/helpers.ts for the QA suites (black-box: they only seed
 * extra Members directly in the DB, because no endpoint makes a viewer/pending/removed Member
 * of a seed User without going through several other endpoints).
 */
import { expect } from "vitest";
import { collections } from "../db/collections.js";

export const T = "tokyo-winter";
export const J = "japan-spring";
export const K = "khao-yai";
export const L = "koh-larn";
export const mid = (tripId: string, key: string) => `${tripId}:${key}`;

/** Thai script somewhere in the string. */
const THAI = /[฀-๿]/;

/** `{ error: { code, message } }` with a Thai message (API.md "Conventions"). */
export function expectError(res: { status: number; body: unknown }, status: number | number[]): void {
  const statuses = Array.isArray(status) ? status : [status];
  expect(statuses, `status ${res.status} body ${JSON.stringify(res.body)}`).toContain(res.status);
  const body = res.body as { error?: { code?: unknown; message?: unknown } };
  expect(typeof body.error?.code).toBe("string");
  expect(typeof body.error?.message).toBe("string");
  expect(body.error!.message as string).toMatch(THAI);
}

/** Adds seed User `n` to Tokyo as a Member with the given role/status (Member id `tokyo-winter:n`). */
export async function addN(role: "owner" | "editor" | "viewer" = "viewer", status: "active" | "pending" | "removed" = "active") {
  await collections.members().insertOne({
    _id: mid(T, "n"),
    tripId: T,
    userId: "n",
    displayName: "N",
    role,
    status,
    color: "slate",
    createdAt: new Date(),
  });
}

/** Changes a seed Member directly (e.g. make Ploy a viewer). */
export async function setMember(memberId: string, set: { role?: "owner" | "editor" | "viewer"; status?: "active" | "pending" | "removed" }) {
  await collections.members().updateOne({ _id: memberId }, { $set: set });
}

export async function activityCount(tripId: string): Promise<number> {
  return collections.activities().countDocuments({ tripId });
}

const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const expectTimestamp = (v: unknown) => expect(v).toMatch(ISO_TS);
export const expectIsoDate = (v: unknown) => expect(v).toMatch(ISO_DATE);

/** Every serialised resource uses `id`, never `_id`. */
export function expectIdNotUnderscore(obj: Record<string, unknown>): void {
  expect(obj).toHaveProperty("id");
  expect(obj).not.toHaveProperty("_id");
}
