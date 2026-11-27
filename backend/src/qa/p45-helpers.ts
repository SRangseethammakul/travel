/**
 * Harness for the phase 4–5 QA suites (`*.p45.qa.test.ts`).
 *
 * Same as src/test/helpers.ts `useTestDb()` (memory server + schema + seed), except that when
 * `QA_LIVE_MONGO_URI` is set (e.g. `mongodb://localhost:27017`) the suite runs against that
 * server instead, in its own throw-away database `tp-qa-p45-<name>` that is dropped afterwards.
 * Used to compare the memory server (mongod 8.2) with the live stack (mongod 9.0).
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, expect } from "vitest";
import { createApp } from "../app.js";
import type { Config } from "../config/config.js";
import { closeDb, connectDb, getDb } from "../db/client.js";
import { ensureSchema } from "../db/schema.js";
import { seed } from "../seed/seed.js";
import { TEST_NOW, testConfig } from "../test/helpers.js";

export function useP45Db(name: string) {
  let mongod: MongoMemoryServer | undefined;
  const live = process.env.QA_LIVE_MONGO_URI;
  beforeAll(async () => {
    let uri: string;
    if (live) {
      uri = `${live.replace(/\/$/, "")}/tp-qa-p45-${name}`;
    } else {
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri("travel-planner-test");
    }
    const db = await connectDb(uri);
    if (live) await db.dropDatabase();
    await ensureSchema(db);
    await seed(db, TEST_NOW);
  });
  afterAll(async () => {
    if (live) await getDb().dropDatabase();
    await closeDb();
    await mongod?.stop();
  });
  return {
    reseed: () => seed(getDb(), TEST_NOW),
  };
}

/** A fresh app per request, like the other suites. Rate limiters that live in a module are shared anyway. */
export const p45App = (config: Partial<Config> = {}) => createApp({ ...testConfig, UPLOAD_DIR: ".data/test-uploads-p45", ...config });

/** supertest types `set-cookie` loosely; it is always a list. */
export const setCookies = (res: { headers: Record<string, unknown> }) => (res.headers["set-cookie"] ?? []) as string[];
/** `name=value` part of a Set-Cookie header. */
export const cookiePair = (setCookie: string) => setCookie.split(";")[0]!;

export const PDF = Buffer.from("%PDF-1.7\n%qa p45\n");
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

/** B12 multipart upload as a seed User. */
export function upload(
  app: ReturnType<typeof createApp>,
  tripId: string,
  user: string,
  file: Buffer | null,
  fields: Record<string, string> = {},
  filename = "file.pdf",
) {
  let req = request(app).post(`/api/trips/${tripId}/documents`).set("Cookie", `mock-user=${user}`);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (file) req = req.attach("file", file, filename);
  return req;
}

/** Fake `fetch` for the OAuth providers. `profile` is what Google userinfo / LINE verify answer. */
export function fakeProviderFetch(profile: Record<string, unknown>, opts: { failToken?: boolean } = {}) {
  return async (input: string | URL) => {
    const url = String(input);
    if (opts.failToken && url.includes("token")) return new Response("nope", { status: 500 });
    if (url.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "at" });
    if (url.includes("api.line.me/oauth2/v2.1/token")) return Response.json({ id_token: "idt" });
    return Response.json(profile);
  };
}

/** Starts an OAuth login and returns the `state` and its signed cookie. */
export async function startLogin(app: ReturnType<typeof createApp>, provider: "google" | "line", next?: string) {
  const res = await request(app).get(`/api/auth/${provider}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  expect(res.status, JSON.stringify(res.body)).toBe(302);
  const state = new URL(res.headers.location!).searchParams.get("state")!;
  const stateCookie = cookiePair(setCookies(res).find((c) => c.startsWith("oauth-state="))!);
  return { res, state, stateCookie };
}
