import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { collections } from "../db/collections.js";
import { errorHandler } from "../errors.js";
import { as, useTestDb } from "../test/helpers.js";
import { currentMember, currentUser, mockUser, requireMember, requireRole, requireUser } from "./middleware.js";

useTestDb();

// Throwaway app: Phase 1 has no trip routes yet, so the middleware is tested on dummy routes.
function testApp() {
  const app = express();
  app.use(cookieParser());
  app.use(mockUser("test"));
  app.get("/me", requireUser, (req, res) => {
    res.json({ id: currentUser(req)._id });
  });
  app.get("/trips/:tripId", requireUser, requireMember, (req, res) => {
    res.json({ memberId: currentMember(req)._id });
  });
  app.post("/trips/:tripId/owner-only", requireUser, requireMember, requireRole("owner"), (_req, res) => {
    res.status(204).end();
  });
  app.post("/trips/:tripId/editors", requireUser, requireMember, requireRole("owner", "editor"), (_req, res) => {
    res.status(204).end();
  });
  app.use(errorHandler);
  return app;
}

beforeAll(async () => {
  const createdAt = new Date();
  await collections.members().insertMany([
    // N is a viewer of Tokyo, and still waiting for approval on Koh Larn.
    { _id: "tokyo-winter:n", tripId: "tokyo-winter", userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt },
    { _id: "koh-larn:n", tripId: "koh-larn", userId: "n", displayName: "N", role: "editor", status: "pending", color: "slate", createdAt },
  ]);
});

describe("mockUser + requireUser", () => {
  it("401 without a cookie or with an unknown User", async () => {
    const app = testApp();
    const none = await request(app).get("/me");
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: { code: "unauthenticated", message: expect.any(String) } });
    expect((await request(app).get("/me").set(as("nobody"))).status).toBe(401);
  });

  it("reads the User id from the mock-user cookie", async () => {
    const res = await request(testApp()).get("/me").set(as("mint"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "mint" });
  });

  it("refuses to run in production", () => {
    expect(() => mockUser("production")).toThrow();
  });
});

describe("requireMember", () => {
  it("finds the Current Member", async () => {
    const res = await request(testApp()).get("/trips/tokyo-winter").set(as("ploy"));
    expect(res.body).toEqual({ memberId: "tokyo-winter:ploy" });
  });

  it("404 for a trip the User is not in, a missing trip, or a pending Member", async () => {
    const app = testApp();
    for (const [user, trip] of [["n", "khao-yai"], ["act", "no-such-trip"], ["n", "koh-larn"]] as const) {
      const res = await request(app).get(`/trips/${trip}`).set(as(user));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("trip_not_found");
    }
  });
});

describe("requireRole", () => {
  it("owner passes owner-only; editor and viewer get 403", async () => {
    const app = testApp();
    expect((await request(app).post("/trips/tokyo-winter/owner-only").set(as("act"))).status).toBe(204);
    expect((await request(app).post("/trips/tokyo-winter/owner-only").set(as("mint"))).status).toBe(403);
    expect((await request(app).post("/trips/tokyo-winter/owner-only").set(as("n"))).status).toBe(403);
  });

  it("editor passes editor routes; viewer gets 403", async () => {
    const app = testApp();
    expect((await request(app).post("/trips/tokyo-winter/editors").set(as("beam"))).status).toBe(204);
    const viewer = await request(app).post("/trips/tokyo-winter/editors").set(as("n"));
    expect(viewer.status).toBe(403);
    expect(viewer.body.error.code).toBe("forbidden");
  });
});
