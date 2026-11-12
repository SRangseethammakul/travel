/**
 * QA phase 5 — "Rate limit + security headers สำหรับ auth และอัปโหลด" (first-backend.md ช่วง 5).
 * Its own file: the upload limiter is module-level, so exhausting it here does not affect the
 * other suites (Vitest isolates modules per test file).
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { as } from "../test/helpers.js";
import { p45App, PDF, upload, useP45Db } from "./p45-helpers.js";
import { expectError, T } from "./qa-helpers.js";

useP45Db("ratelimit");

describe("rate limits answer 429 in the API error shape", () => {
  it("auth: the 31st request in the window from one client → 429", async () => {
    const app = p45App({ GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" });
    for (let i = 0; i < 30; i++) {
      expect((await request(app).get("/api/auth/google")).status).toBe(302);
    }
    const res = await request(app).get("/api/auth/google");
    expectError(res, 429);
    expect(res.headers["ratelimit-policy"] ?? res.headers["ratelimit"]).toBeDefined();
  });

  it("uploads: the 31st upload by one User → 429, other reads and other Users still work", async () => {
    const app = p45App();
    for (let i = 0; i < 30; i++) {
      expect((await upload(app, T, "mint", PDF, { name: `doc ${i}` })).status).toBe(201);
    }
    expectError(await upload(app, T, "mint", PDF, { name: "one too many" }), 429);
    expect((await request(app).get(`/api/trips/${T}/documents`).set(as("mint"))).status).toBe(200);
    // Counted per User, not per IP: every request here comes from the same IP (as through Next).
    expect((await upload(app, T, "act", PDF, { name: "act is not locked out" })).status).toBe(201);
  });

  it("auth: logout is never rate limited (all requests can arrive from the Next server's IP)", async () => {
    const app = p45App({ GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" });
    for (let i = 0; i < 35; i++) {
      expect((await request(app).post("/api/auth/logout")).status).toBe(204);
    }
  });

  it("auth: TRUST_PROXY=1 counts each X-Forwarded-For client on its own", async () => {
    const app = p45App({ GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret", TRUST_PROXY: 1 });
    const from = (ip: string) => request(app).get("/api/auth/google").set("X-Forwarded-For", ip);
    for (let i = 0; i < 30; i++) expect((await from("203.0.113.1")).status).toBe(302);
    expectError(await from("203.0.113.1"), 429);
    expect((await from("203.0.113.2")).status).toBe(302);
  });

  it("auth: TRUST_PROXY=0 ignores X-Forwarded-For (a client cannot pick its own bucket)", async () => {
    const app = p45App({ GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" });
    for (let i = 0; i < 30; i++) {
      expect((await request(app).get("/api/auth/google").set("X-Forwarded-For", `198.51.100.${i}`)).status).toBe(302);
    }
    expectError(await request(app).get("/api/auth/google").set("X-Forwarded-For", "198.51.100.200"), 429);
  });
});
