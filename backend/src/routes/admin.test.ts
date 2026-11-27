import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { touchLastSeen } from "../auth/session.js";
import { collections } from "../db/collections.js";
import { newId } from "../db/ids.js";
import { todayInBangkok } from "../domain/trip-dates.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { shouldRecordRequest } from "../utils/request-log.js";

const t = useTestDb();
const config = { ...testConfig, ADMIN_USER_IDS: ["act", "mint"] };
const app = () => createApp(config);
const admin = as("act");

beforeEach(() => t.reseed());

const ROUTES: [method: "get" | "post", path: string][] = [
  ["get", "/api/admin/whoami"],
  ["get", "/api/admin/overview"],
  ["get", "/api/admin/users"],
  ["get", "/api/admin/users/act"],
  ["post", "/api/admin/users/mint/signout"],
  ["get", "/api/admin/trips"],
  ["get", "/api/admin/trips/tokyo-winter"],
  ["get", "/api/admin/system"],
];

describe("admin access", () => {
  it.each(ROUTES)("%s %s: signed out 401, non-admin 404 (never 403), admin passes", async (method, path) => {
    expect((await request(app())[method](path)).status).toBe(401);
    const other = await request(app())[method](path).set(as("beam"));
    expect(other.status).toBe(404);
    expect(other.body).toEqual({ error: { code: "not_found", message: "ไม่พบหน้านี้" } });
    expect((await request(app())[method](path).set(admin)).status).toBeLessThan(300);
    await t.reseed();
  });

  it("nobody is admin when ADMIN_USER_IDS is empty", async () => {
    const res = await request(createApp(testConfig)).get("/api/admin/whoami").set(admin);
    expect(res.status).toBe(404);
  });

  it("whoami returns the signed-in User", async () => {
    const res = await request(app()).get("/api/admin/whoami").set(admin);
    expect(res.body).toEqual({ user: { id: "act", name: "Act", email: "act@example.com", provider: "google", color: "teal" } });
  });
});

describe("GET /api/admin/overview", () => {
  it("returns zero-filled daily series of the requested length", async () => {
    for (const days of [7, 30, 90]) {
      const res = await request(app()).get(`/api/admin/overview?days=${days}`).set(admin);
      expect(res.status).toBe(200);
      expect(res.body.daily).toHaveLength(days);
      expect(res.body.daily.at(-1).date).toBe(todayInBangkok());
    }
    expect((await request(app()).get("/api/admin/overview?days=10").set(admin)).status).toBe(400);
  });

  it("counts new users, trips, signups and busy trips in the window", async () => {
    const now = new Date();
    await collections.users().insertOne({ _id: "fresh", name: "Fresh", email: "f@example.com", provider: "line", color: "gray", createdAt: now });
    await collections.activities().insertMany([
      { _id: newId(), tripId: "tokyo-winter", actorId: "tokyo-winter:act", type: "plan", refId: null, text: "x", createdAt: now, readBy: [] },
      { _id: newId(), tripId: "tokyo-winter", actorId: "tokyo-winter:act", type: "plan", refId: null, text: "y", createdAt: now, readBy: [] },
      { _id: newId(), tripId: "khao-yai", actorId: "khao-yai:mint", type: "plan", refId: null, text: "z", createdAt: now, readBy: [] },
    ]);
    const res = await request(app()).get("/api/admin/overview?days=7").set(admin);
    const b = res.body;
    expect(b.totals).toEqual({ users: 8, trips: 4 });
    expect(b.kpis.usersNew.current).toBe(1);
    expect(b.kpis.signups7d.current).toBe(1);
    expect(b.kpis.activeTrips7d.current).toBe(2);
    expect(b.daily.at(-1)).toMatchObject({ date: todayInBangkok(), users: 1 });
    expect(b.providers).toEqual({ google: 3, line: 5 });
    expect(b.recentUsers[0]).toMatchObject({ id: "fresh", tripCount: 0, lastSeenAt: null });
    expect(b.recentUsers).toHaveLength(5);
    expect(b.busiestTrips.map((x: { id: string; activity7d: number }) => [x.id, x.activity7d])).toEqual([
      ["tokyo-winter", 2],
      ["khao-yai", 1],
    ]);
    expect(Number.isInteger(b.usersInTripPct)).toBe(true);
    expect(b.avgMembersPerTrip).toBeGreaterThan(0);
  });
});

describe("GET /api/admin/users", () => {
  it("pages 20 at a time and reports the total", async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      _id: `bulk-${i}`,
      name: `Bulk ${String(i).padStart(2, "0")}`,
      email: `bulk${i}@example.com`,
      provider: "line" as const,
      color: "gray" as const,
      createdAt: new Date(Date.now() - i * 1000),
    }));
    await collections.users().insertMany(docs);
    const p1 = await request(app()).get("/api/admin/users?sort=name&dir=asc").set(admin);
    expect(p1.body).toMatchObject({ page: 1, pageSize: 20, total: 32 });
    expect(p1.body.items).toHaveLength(20);
    const p2 = await request(app()).get("/api/admin/users?sort=name&dir=asc&page=2").set(admin);
    expect(p2.body.items).toHaveLength(12);
    expect((await request(app()).get("/api/admin/users?page=0").set(admin)).status).toBe(400);
    expect((await request(app()).get("/api/admin/users?sort=email").set(admin)).status).toBe(400);
  });

  it("searches name or email (case-insensitive, regex-safe) and filters by provider", async () => {
    const byName = await request(app()).get("/api/admin/users?q=MINT").set(admin);
    expect(byName.body.items.map((u: { id: string }) => u.id)).toEqual(["mint"]);
    const byEmail = await request(app()).get("/api/admin/users?q=ploy@").set(admin);
    expect(byEmail.body.items.map((u: { id: string }) => u.id)).toEqual(["ploy"]);
    expect((await request(app()).get("/api/admin/users?q=.*").set(admin)).body.total).toBe(0);
    const google = await request(app()).get("/api/admin/users?provider=google&sort=name&dir=asc").set(admin);
    expect(google.body.items.map((u: { id: string }) => u.id)).toEqual(["act", "adam", "n"]);
  });

  it("row has trip count and lastSeenAt", async () => {
    const res = await request(app()).get("/api/admin/users?q=act").set(admin);
    expect(res.body.items[0]).toMatchObject({ id: "act", provider: "google", color: "teal" });
    expect(res.body.items[0].tripCount).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty("lastSeenAt");
  });
});

describe("GET /api/admin/users/:id", () => {
  it("returns the account, its trips with role, and latest activity", async () => {
    const res = await request(app()).get("/api/admin/users/mint").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: "mint", sessionVersion: 0 });
    const tokyo = res.body.trips.find((x: { id: string }) => x.id === "tokyo-winter");
    expect(tokyo).toMatchObject({ role: "editor", status: "upcoming" });
    expect(res.body.user.tripCount).toBe(res.body.trips.length);
    expect(res.body.activity.length).toBeGreaterThan(0);
    expect(res.body.activity.length).toBeLessThanOrEqual(10);
    expect(res.body.activity[0]).toMatchObject({ tripId: expect.any(String), tripName: expect.any(String) });
  });

  it("unknown user is 404", async () => {
    const res = await request(app()).get("/api/admin/users/nobody").set(admin);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("POST /api/admin/users/:id/signout", () => {
  it("bumps sessionVersion and answers 204", async () => {
    const res = await request(app()).post("/api/admin/users/mint/signout").set(admin);
    expect(res.status).toBe(204);
    const detail = await request(app()).get("/api/admin/users/mint").set(admin);
    expect(detail.body.user.sessionVersion).toBe(1);
  });

  it("refuses to sign yourself out", async () => {
    const res = await request(app()).post("/api/admin/users/act/signout").set(admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("cannot_sign_out_self");
    expect((await collections.users().findOne({ _id: "act" }))?.sessionVersion ?? 0).toBe(0);
  });

  it("unknown user is 404", async () => {
    expect((await request(app()).post("/api/admin/users/nobody/signout").set(admin)).status).toBe(404);
  });
});

describe("GET /api/admin/trips", () => {
  it("lists trips with owners, member count, spent and status", async () => {
    const res = await request(app()).get("/api/admin/trips?sort=startDate&dir=asc").set(admin);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 4 });
    const tokyo = res.body.items.find((x: { id: string }) => x.id === "tokyo-winter");
    expect(tokyo.owners).toEqual([{ memberId: "tokyo-winter:act", name: "Act", userId: "act" }]);
    expect(tokyo.memberCount).toBe(4);
    const expected = (await collections.expenses().find({ tripId: "tokyo-winter" }).toArray()).reduce((s, e) => s + e.amount, 0);
    expect(tokyo.spent).toBe(expected);
    expect(tokyo.spent).toBeGreaterThan(0);
    const dates = res.body.items.map((x: { startDate: string }) => x.startDate);
    expect(dates).toEqual([...dates].sort());
  });

  it("filters by status computed in Bangkok time", async () => {
    const today = todayInBangkok();
    const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    await collections.trips().updateOne({ _id: "koh-larn" }, { $set: { startDate: shift(-1), endDate: shift(1) } });
    await collections.trips().updateOne({ _id: "khao-yai" }, { $set: { startDate: shift(-5), endDate: today } });
    await collections.trips().updateOne({ _id: "tokyo-winter" }, { $set: { startDate: shift(1), endDate: shift(3) } });
    await collections.trips().updateOne({ _id: "japan-spring" }, { $set: { startDate: shift(-9), endDate: shift(-8) } });
    const ids = async (status: string) =>
      ((await request(app()).get(`/api/admin/trips?status=${status}&sort=startDate&dir=asc`).set(admin)).body.items as { id: string; status: string }[]).map((x) => `${x.id}:${x.status}`);
    expect(await ids("ongoing")).toEqual(["khao-yai:ongoing", "koh-larn:ongoing"]);
    expect(await ids("upcoming")).toEqual(["tokyo-winter:upcoming"]);
    expect(await ids("past")).toEqual(["japan-spring:past"]);
    expect((await request(app()).get("/api/admin/trips?status=nope").set(admin)).status).toBe(400);
  });

  it("searches trip name, destination, owner Member displayName and owner User name", async () => {
    const find = async (q: string) =>
      ((await request(app()).get(`/api/admin/trips?q=${encodeURIComponent(q)}&sort=createdAt&dir=asc`).set(admin)).body.items as { id: string }[]).map((x) => x.id).sort();
    expect(await find("เกาะล้าน")).toEqual(["koh-larn"]);
    expect(await find("ชลบุรี")).toEqual(["koh-larn"]);
    // owner of khao-yai is Mint; rename the Member so the two names differ
    await collections.members().updateOne({ _id: "khao-yai:mint" }, { $set: { displayName: "พี่มิ้นท์" } });
    expect(await find("พี่มิ้น")).toEqual(["khao-yai"]);
    expect(await find("mint")).toContain("khao-yai"); // linked User name
    expect(await find("zzz-nobody")).toEqual([]);
    expect(await find(".*")).toEqual([]);
  });

  it("never counts personal expenses in spent", async () => {
    const before = (await request(app()).get("/api/admin/trips/tokyo-winter").set(admin)).body.trip.spent;
    await collections.personalExpenses().insertOne({
      _id: "pe-extra",
      tripId: "tokyo-winter",
      ownerId: "tokyo-winter:act",
      title: "secret",
      category: "food",
      amount: 999_900,
      currency: "THB",
      baseAmount: 999_900,
      method: "cash",
      date: "2026-12-12",
      createdAt: new Date(),
    });
    const list = await request(app()).get("/api/admin/trips?q=โตเกียว").set(admin);
    expect(list.body.items[0].spent).toBe(before);
    expect(JSON.stringify(list.body)).not.toContain("secret");
  });
});

describe("GET /api/admin/trips/:id", () => {
  it("returns members, counts (group checklist only) and latest activity", async () => {
    const res = await request(app()).get("/api/admin/trips/tokyo-winter").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.trip).toMatchObject({ id: "tokyo-winter", createdBy: { id: "act", name: "Act" }, status: "upcoming" });
    expect(res.body.members).toHaveLength(4);
    expect(res.body.members[0]).toMatchObject({ id: expect.any(String), role: expect.any(String), status: "active", color: expect.any(String) });
    const db = {
      places: await collections.places().countDocuments({ tripId: "tokyo-winter" }),
      planItems: await collections.planItems().countDocuments({ tripId: "tokyo-winter" }),
      expenses: await collections.expenses().countDocuments({ tripId: "tokyo-winter" }),
      settlements: await collections.settlements().countDocuments({ tripId: "tokyo-winter" }),
      checklistItems: await collections.checklistItems().countDocuments({ tripId: "tokyo-winter", scope: "group" }),
    };
    expect(res.body.counts).toEqual({ ...db, activity7d: 0 });
    expect(res.body.activity).toHaveLength(5);
    expect(res.body.activity[0]).toMatchObject({ actorName: expect.any(String), text: expect.any(String) });
  });

  it("unknown trip is 404", async () => {
    expect((await request(app()).get("/api/admin/trips/nope").set(admin)).status).toBe(404);
  });
});

describe("GET /api/admin/system", () => {
  const logs = async (filter = "all", page = 1) => (await request(app()).get(`/api/admin/system?filter=${filter}&page=${page}`).set(admin)).body;
  const log = (over: { status: number; ms: number; path?: string; at?: Date }) => ({
    _id: newId(),
    at: over.at ?? new Date(),
    method: "GET",
    path: over.path ?? "/api/test",
    status: over.status,
    ms: over.ms,
    userId: null,
  });

  it("reports api, mongo, storage, rate limit, hourly errors and logs", async () => {
    const before = await logs();
    await collections.requestLogs().insertMany([log({ status: 200, ms: 20 }), log({ status: 404, ms: 10 }), log({ status: 429, ms: 5 }), log({ status: 503, ms: 900 })]);
    const s = await logs();
    expect(s.api.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(s.api.p95Ms1h).toBeGreaterThanOrEqual(900);
    expect(s.mongo).toMatchObject({ ok: true, collections: expect.any(Number) });
    expect(s.mongo.pingMs).toBeGreaterThanOrEqual(0);
    expect(s.storage).toEqual({ driver: "local" });
    expect(s.rateLimit.blocked24h).toBe(before.rateLimit.blocked24h + 1);
    expect(s.errorsByHour).toHaveLength(24);
    const last = s.errorsByHour.at(-1);
    expect(last.c4xx - before.errorsByHour.at(-1).c4xx).toBe(2);
    expect(last.c5xx - before.errorsByHour.at(-1).c5xx).toBe(1);
    expect(last.total - before.errorsByHour.at(-1).total).toBe(4);
    expect(s.logs).toMatchObject({ page: 1, pageSize: 20, total: before.logs.total + 4 });
    expect(s.logs.items[0]).toMatchObject({ status: 503, ms: 900, userId: null, id: expect.any(String), at: expect.any(String) });
  });

  it("filters 4xx, 5xx and slow (>= 500 ms)", async () => {
    const b = { all: (await logs()).logs.total, c4: (await logs("4xx")).logs.total, c5: (await logs("5xx")).logs.total, slow: (await logs("slow")).logs.total };
    await collections.requestLogs().insertMany([log({ status: 200, ms: 20 }), log({ status: 404, ms: 10 }), log({ status: 500, ms: 500 }), log({ status: 200, ms: 499 })]);
    expect((await logs()).logs.total).toBe(b.all + 4);
    expect((await logs("4xx")).logs.total).toBe(b.c4 + 1);
    expect((await logs("5xx")).logs.total).toBe(b.c5 + 1);
    expect((await logs("slow")).logs.total).toBe(b.slow + 1);
    expect((await request(app()).get("/api/admin/system?filter=bad").set(admin)).status).toBe(400);
  });
});

describe("request log recording", () => {
  const recording = () => createApp(config, { recordRequests: true });
  const waitForLog = async (path: string) => {
    for (let i = 0; i < 50; i++) {
      const found = await collections.requestLogs().findOne({ path });
      if (found) return found;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  };

  it("records method, path (no query string), status, ms and user", async () => {
    await request(recording()).get("/api/me?token=secret").set(as("beam"));
    const entry = await waitForLog("/api/me");
    expect(entry).toMatchObject({ method: "GET", path: "/api/me", status: 200, userId: "beam" });
    expect(Number.isInteger(entry?.ms)).toBe(true);
    expect(await collections.requestLogs().countDocuments({ path: { $regex: "secret" } })).toBe(0);
  });

  it("skips /api/health and /api/admin", async () => {
    const before = await collections.requestLogs().countDocuments({ path: { $in: ["/api/health"] } });
    await request(recording()).get("/api/health");
    await request(recording()).get("/api/admin/overview").set(admin);
    await request(recording()).get("/api/zzz-marker");
    await waitForLog("/api/zzz-marker");
    expect(await collections.requestLogs().countDocuments({ path: "/api/health" })).toBe(before);
    expect(await collections.requestLogs().countDocuments({ path: { $regex: "^/api/admin" } })).toBe(0);
  });

  it("does not record under test by default", async () => {
    await request(app()).get("/api/nope-default");
    await new Promise((r) => setTimeout(r, 100));
    expect(await collections.requestLogs().countDocuments({ path: "/api/nope-default" })).toBe(0);
  });

  it("shouldRecordRequest", () => {
    expect(shouldRecordRequest("/api/health")).toBe(false);
    expect(shouldRecordRequest("/api/admin")).toBe(false);
    expect(shouldRecordRequest("/api/admin/users")).toBe(false);
    expect(shouldRecordRequest("/api/administrators")).toBe(true);
    expect(shouldRecordRequest("/api/trips")).toBe(true);
  });

  it("the collection is capped at 1,000 documents", async () => {
    const stats = await t.db().collection("requestLogs").aggregate([{ $collStats: { storageStats: {} } }]).next();
    expect(stats?.storageStats).toMatchObject({ capped: true, max: 1000 });
  });
});

describe("lastSeenAt", () => {
  const lastSeen = async (id: string) => (await collections.users().findOne({ _id: id }))?.lastSeenAt;

  it("is written when missing, then not again within 10 minutes, and again after", async () => {
    const t0 = new Date("2026-11-20T10:00:00Z");
    const user = (await collections.users().findOne({ _id: "n" }))!;
    expect(user.lastSeenAt).toBeUndefined();
    await touchLastSeen(user, t0);
    expect(await lastSeen("n")).toEqual(t0);

    const fresh = (await collections.users().findOne({ _id: "n" }))!;
    await touchLastSeen(fresh, new Date(t0.getTime() + 9 * 60_000));
    expect(await lastSeen("n")).toEqual(t0);

    const t1 = new Date(t0.getTime() + 11 * 60_000);
    await touchLastSeen(fresh, t1);
    expect(await lastSeen("n")).toEqual(t1);
  });

  it("a request as a signed-in User sets it without delaying the response", async () => {
    await request(app()).get("/api/me").set(as("eva"));
    for (let i = 0; i < 50 && !(await lastSeen("eva")); i++) await new Promise((r) => setTimeout(r, 20));
    expect(await lastSeen("eva")).toBeInstanceOf(Date);
  });
});
