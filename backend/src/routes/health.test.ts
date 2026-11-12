import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { testConfig, useTestDb } from "../test/helpers.js";

useTestDb();

describe("GET /api/health", () => {
  it("answers ok when MongoDB answers ping", async () => {
    const res = await request(createApp(testConfig)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("unknown routes use the error shape", async () => {
    const res = await request(createApp(testConfig)).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "not_found", message: expect.any(String) } });
  });
});
