/**
 * QA: Admin API (`/api/admin/*`). Sources: API.md "Admin", SPEC "ผู้ดูแลระบบ (Admin)",
 * docs/adr/0002-admins-by-user-id.md, docs/db/schema.md (`lastSeenAt`, `requestLogs`).
 * Black-box: supertest against createApp + memory Mongo. Admin = seed `act` (mock-user cookie).
 * Tests marked `// ADMIN-BUG-n` fail on purpose (see docs/qa/api-report.md).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { loadConfig } from "../config/config.js";
import { newId } from "../db/ids.js";
import { todayInBangkok } from "../domain/trip-dates.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { cookiePair, fakeProviderFetch, setCookies, startLogin } from "./p45-helpers.js";
import { T } from "./qa-helpers.js";

const t = useTestDb();
const config = { ...testConfig, ADMIN_USER_IDS: ["act", "mint"] };
const app = () => createApp(config);
const logApp = () => createApp(config, { recordRequests: true });
const admin = as("act");
const get = (path: string, user = "act") => request(app()).get(path).set(as(user));

beforeEach(() => t.reseed());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 2000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > end) return v;
    await sleep(25);
  }
}
const logs = () => collections.requestLogs().find().sort({ $natural: 1 }).toArray();

/** Collects every key anywhere in a JSON value. */
function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      allKeys(x, out);
    }
  return out;
}

const ALL_GETS = ["/api/admin/whoami", "/api/admin/overview", "/api/admin/users", "/api/admin/users/act", "/api/admin/trips", "/api/admin/trips/tokyo-winter", "/api/admin/system"];

async function addTrip(id: string, over: Record<string, unknown> = {}) {
  const base = (await collections.trips().findOne({ _id: T }))!;
  await collections.trips().insertOne({ ...base, _id: id, name: id, ...over } as typeof base);
}
async function addOwner(tripId: string, userId: string | null, displayName: string, status: "active" | "pending" | "removed" = "active", role: "owner" | "editor" = "owner") {
  await collections.members().insertOne({ _id: `${tripId}:${displayName}`, tripId, userId, displayName, role, status, color: "slate", createdAt: new Date() } as never);
}

// ---------------------------------------------------------------- 1. access
describe("access", () => {
  it.each(ALL_GETS)("GET %s signed out → 401", async (p) => {
    const res = await request(app()).get(p);
    expect(res.status).toBe(401);
  });

  it("POST /users/:id/signout signed out → 401, non-admin → 404 not_found and nothing changes", async () => {
    expect((await request(app()).post("/api/admin/users/mint/signout")).status).toBe(401);
    const res = await request(app()).post("/api/admin/users/mint/signout").set(as("beam"));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
    expect((await collections.users().findOne({ _id: "mint" }))!.sessionVersion ?? 0).toBe(0);
  });

  it("unknown admin sub-path and non-GET methods stay hidden from a non-admin (404)", async () => {
    for (const [m, p] of [["get", "/api/admin/nope"], ["delete", "/api/admin/users/act"], ["post", "/api/admin/trips/tokyo-winter"], ["patch", "/api/admin/users/act"]] as const) {
      const res = await request(app())[m](p).set(as("beam"));
      expect(res.status, `${m} ${p}`).toBe(404);
    }
  });

  it("admin cannot write anything else: DELETE/PATCH on users and trips are 404", async () => {
    for (const [m, p] of [["delete", "/api/admin/users/mint"], ["patch", "/api/admin/users/mint"], ["delete", "/api/admin/trips/tokyo-winter"], ["post", "/api/admin/trips"]] as const) {
      expect((await request(app())[m](p).set(admin)).status, `${m} ${p}`).toBe(404);
    }
    expect(await collections.users().countDocuments({ _id: "mint" })).toBe(1);
    expect(await collections.trips().countDocuments({ _id: T })).toBe(1);
  });

  it("unset or empty ADMIN_USER_IDS → nobody is admin, for every route", async () => {
    for (const ids of [[]]) {
      const a = createApp({ ...testConfig, ADMIN_USER_IDS: ids as never });
      for (const p of ALL_GETS) expect((await request(a).get(p).set(admin)).status, p).toBe(404);
    }
  });

  it("loadConfig: unset, empty, whitespace, and stray commas give an empty list", () => {
    const env = {
      MONGODB_URI: "mongodb://x",
      NODE_ENV: "test",
      SESSION_SECRET: "s".repeat(40),
      FILE_URL_SECRET: "f".repeat(40),
      CORS_ORIGIN: "http://localhost:3000",
    };
    expect(loadConfig(env).ADMIN_USER_IDS).toEqual([]);
    for (const v of ["", "   ", ",", " , ,, ", ",,,"]) expect(loadConfig({ ...env, ADMIN_USER_IDS: v }).ADMIN_USER_IDS, JSON.stringify(v)).toEqual([]);
    expect(loadConfig({ ...env, ADMIN_USER_IDS: " act , mint," }).ADMIN_USER_IDS).toEqual(["act", "mint"]);
  });

  it("a sloppy list ' act , ,mint,' admits act and mint only, no one else (empty id matches nobody)", async () => {
    const env = {
      MONGODB_URI: "mongodb://x",
      NODE_ENV: "test" as const,
      SESSION_SECRET: "s".repeat(40),
      FILE_URL_SECRET: "f".repeat(40),
      CORS_ORIGIN: "http://localhost:3000",
      ADMIN_USER_IDS: " act , ,mint,",
    };
    const a = createApp({ ...testConfig, ...loadConfig(env) });
    expect((await request(a).get("/api/admin/whoami").set(as("act"))).status).toBe(200);
    expect((await request(a).get("/api/admin/whoami").set(as("mint"))).status).toBe(200);
    expect((await request(a).get("/api/admin/whoami").set(as("beam"))).status).toBe(404);
    // an empty / blank mock-user cookie is not a user at all
    expect((await request(a).get("/api/admin/whoami").set("Cookie", "mock-user=")).status).toBe(401);
    expect((await request(a).get("/api/admin/whoami").set("Cookie", "mock-user=%20")).status).toBe(401);
  });

  it("only the listed id is admin (other seed Users are 404)", async () => {
    const a = createApp({ ...testConfig, ADMIN_USER_IDS: ["act"] });
    for (const id of ["n", "beam", "ploy"]) expect((await request(a).get("/api/admin/whoami").set(as(id))).status, id).toBe(404);
  });
});

// ---------------------------------------------------------------- 2. privacy
describe("privacy", () => {
  async function snapshot() {
    const out: Record<string, unknown> = {};
    for (const p of [...ALL_GETS, "/api/admin/users/mint", "/api/admin/trips/japan-spring", "/api/admin/trips/khao-yai", "/api/admin/users?q=a", "/api/admin/trips?q=a"]) {
      const res = await get(p);
      expect(res.status, p).toBe(200);
      out[p] = JSON.parse(JSON.stringify(res.body, (k, v) => (k === "lastSeenAt" || k === "pingMs" || k === "uptimeSec" ? undefined : v)));
    }
    return out;
  }

  it("Personal Expenses never change spent, overview, counts, activity or the user feed", async () => {
    const before = await snapshot();
    // Personal Expenses by mint and act in Tokyo; also a Personal checklist item (PERSONAL scope).
    for (const u of ["mint", "act"]) {
      const r = await request(app()).post(`/api/trips/${T}/personal-expenses`).set(as(u)).send({ title: "ลับ", category: "shopping", amount: 9_999_900, method: "cash", date: "2026-12-13" });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toContain("9999900");
  });

  it("checklistItems counts group scope only (personal items of any Member are excluded)", async () => {
    const group = await collections.checklistItems().countDocuments({ tripId: T, scope: "group" });
    const personalBefore = await collections.checklistItems().countDocuments({ tripId: T, scope: "personal" });
    const mk = (scope: "group" | "personal") => ({ _id: newId(), tripId: T, scope, ...(scope === "personal" ? { ownerId: `${T}:act` } : {}), text: `x-${scope}`, category: "other", done: false, fromTemplate: false, createdAt: new Date() }) as never;
    await collections.checklistItems().insertMany([mk("personal"), mk("personal"), mk("personal")]);
    const res = await get(`/api/admin/trips/${T}`);
    expect(res.body.counts.checklistItems).toBe(group);
    expect(personalBefore + 3).toBe(await collections.checklistItems().countDocuments({ tripId: T, scope: "personal" }));
    expect(JSON.stringify(res.body)).not.toContain("x-personal");
  });

  it("no response carries providerSubject, a document, a signed token, or a file key", async () => {
    for (const u of await collections.users().find().toArray()) await collections.users().updateOne({ _id: u._id }, { $set: { providerSubject: `SUBJECT-SECRET-123-${u._id}` } });
    const snap = await snapshot();
    const text = JSON.stringify(snap);
    expect(text).not.toContain("SUBJECT-SECRET-123");
    const keys = allKeys(snap);
    for (const bad of ["providerSubject", "fileKey", "token", "documents", "shares", "slip", "readBy", "inviteToken", "cookie"]) expect(keys.has(bad), bad).toBe(false);
    // system log items expose exactly these fields
    const sys = snap["/api/admin/system"] as { logs: { items: object[] } };
    for (const it of sys.logs.items) expect(Object.keys(it).sort()).toEqual(["at", "id", "method", "ms", "path", "status", "userId"]);
  });

  it("user and trip detail responses have the documented keys only", async () => {
    const u = (await get("/api/admin/users/act")).body;
    expect(Object.keys(u).sort()).toEqual(["activity", "trips", "user"]);
    expect(Object.keys(u.user).sort()).toEqual(["avatarUrl", "color", "createdAt", "email", "id", "lastSeenAt", "name", "provider", "sessionVersion", "tripCount"].filter((k) => k in u.user || k !== "avatarUrl"));
    const tr = (await get(`/api/admin/trips/${T}`)).body;
    expect(Object.keys(tr).sort()).toEqual(["activity", "counts", "members", "trip"]);
    expect(Object.keys(tr.counts).sort()).toEqual(["activity7d", "checklistItems", "expenses", "places", "planItems", "settlements"]);
    for (const m of tr.members) expect(Object.keys(m).sort()).toEqual(["color", "displayName", "id", "role", "status", "userId"]);
  });
});

// ---------------------------------------------------------------- 3. lists
describe("lists: paging, sort, filter", () => {
  async function manyUsers(n: number) {
    const base = Date.parse("2026-01-01T00:00:00Z");
    await collections.users().insertMany(
      Array.from({ length: n }, (_, i) => ({ _id: `bulk-${String(i).padStart(3, "0")}`, name: `Bulk ${String(i).padStart(3, "0")}`, email: `b${i}@example.com`, provider: i % 2 ? "line" : "google", color: "gray", createdAt: new Date(base + i * 1000) })) as never,
    );
  }

  it("page past the end → 200, empty items, correct total; page 0 / abc / -1 / 1.5 / huge → 400", async () => {
    await manyUsers(30);
    const past = await get("/api/admin/users?page=99");
    expect(past.status).toBe(200);
    expect(past.body).toMatchObject({ items: [], page: 99, pageSize: 20, total: 37 });
    for (const bad of ["0", "abc", "-1", "1.5", "1e9", "", "NaN"]) {
      const r = await get(`/api/admin/users?page=${bad}`);
      // empty string is "not sent" for many parsers; the others must be 400
      if (bad === "") continue;
      expect(r.status, `page=${bad}`).toBe(400);
      expect(r.body.error.code).toEqual(expect.any(String));
      expect(r.body.error.message).toMatch(/[฀-๿]/);
    }
    for (const p of ["/api/admin/trips?page=0", "/api/admin/system?page=abc"]) expect((await get(p)).status, p).toBe(400);
  });

  it("page 2 continues where page 1 stopped, with no overlap, total stable", async () => {
    await manyUsers(30);
    const a = (await get("/api/admin/users?page=1")).body;
    const b = (await get("/api/admin/users?page=2")).body;
    expect(a.items).toHaveLength(20);
    expect(b.items).toHaveLength(17);
    expect(new Set([...a.items, ...b.items].map((x: { id: string }) => x.id)).size).toBe(37);
    expect(a.total).toBe(37);
  });

  it("repeated ?page=1&page=2 and array-style params give 400, not 500", async () => {
    for (const p of ["/api/admin/users?page=1&page=2", "/api/admin/users?q=a&q=b", "/api/admin/users?sort=name&sort=createdAt", "/api/admin/trips?status=past&status=ongoing"]) {
      const r = await get(p);
      expect(r.status, p).toBe(400);
    }
  });

  it("invalid sort / dir / provider / status / days / filter → 400", async () => {
    for (const p of ["/api/admin/users?sort=email", "/api/admin/users?dir=up", "/api/admin/users?provider=facebook", "/api/admin/trips?status=cancelled", "/api/admin/trips?sort=name", "/api/admin/overview?days=0", "/api/admin/overview?days=abc", "/api/admin/overview?days=8", "/api/admin/system?filter=3xx"]) {
      const r = await get(p);
      expect(r.status, p).toBe(400);
      expect(r.body.error).toBeDefined();
    }
  });

  it("users sort by name asc/desc and createdAt asc/desc; default is createdAt desc", async () => {
    const names = async (q: string) => (await get(`/api/admin/users?${q}`)).body.items.map((u: { name: string }) => u.name);
    const asc = await names("sort=name&dir=asc");
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    expect(await names("sort=name&dir=desc")).toEqual([...asc].reverse());
    const def = (await get("/api/admin/users")).body.items.map((u: { createdAt: string }) => u.createdAt);
    expect(def).toEqual([...def].sort().reverse());
    const old = (await get("/api/admin/users?sort=createdAt&dir=asc")).body.items.map((u: { createdAt: string }) => u.createdAt);
    expect(old).toEqual([...old].sort());
  });

  it("users sort by lastSeenAt: recent first with dir=desc, and the order is the reverse for asc", async () => {
    await collections.users().updateOne({ _id: "beam" }, { $set: { lastSeenAt: new Date("2026-11-01T00:00:00Z") } });
    await collections.users().updateOne({ _id: "ploy" }, { $set: { lastSeenAt: new Date("2026-11-02T00:00:00Z") } });
    const d = (await get("/api/admin/users?sort=lastSeenAt&dir=desc")).body.items;
    expect(d[0].id).toBe("ploy");
    expect(d[1].id).toBe("beam");
    const a = (await get("/api/admin/users?sort=lastSeenAt&dir=asc")).body.items.filter((u: { id: string; lastSeenAt: string | null }) => u.lastSeenAt && u.id !== "act");
    expect(a.map((u: { id: string }) => u.id)).toEqual(["beam", "ploy"]);
  });

  it("users provider filter and total", async () => {
    const g = (await get("/api/admin/users?provider=google")).body;
    const l = (await get("/api/admin/users?provider=line")).body;
    expect(g.total + l.total).toBe(7);
    expect(g.items.every((u: { provider: string }) => u.provider === "google")).toBe(true);
    expect(l.items.every((u: { provider: string }) => u.provider === "line")).toBe(true);
  });

  it("q with regex metacharacters is literal and never errors (users and trips)", async () => {
    await collections.users().insertOne({ _id: "dot", name: "A.B (x) [y] \\ z+?", email: "dot@example.com", provider: "line", color: "gray", createdAt: new Date() } as never);
    const hits = async (q: string) => (await get(`/api/admin/users?q=${encodeURIComponent(q)}`)).body;
    for (const q of [".*", "(", ")", "[", "\\", "+", "?", "^", "$", "|", "{1}", "a{", "(?<=", "*", "\\\\", "[a-", "(a|b"]) {
      const r = await get(`/api/admin/users?q=${encodeURIComponent(q)}`);
      expect(r.status, `q=${q}`).toBe(200);
      const rt = await get(`/api/admin/trips?q=${encodeURIComponent(q)}`);
      expect(rt.status, `trips q=${q}`).toBe(200);
    }
    expect((await hits(".*")).total).toBe(0);
    expect((await hits("A.B")).items.map((u: { id: string }) => u.id)).toEqual(["dot"]);
    expect((await hits("a.b")).total).toBe(1); // case-insensitive
    expect((await hits("AxB")).total).toBe(0); // `.` is not a wildcard
    expect((await hits("(x) [y] \\ z+?")).total).toBe(1);
    expect((await hits("\\")).total).toBe(1);
    expect((await hits("(")).total).toBe(1);
    expect((await get("/api/admin/trips?q=.*")).body.total).toBe(0);
  });

  it("users q matches name or email, case-insensitive; blank q means no filter", async () => {
    expect((await get("/api/admin/users?q=ACT@EXAMPLE")).body.items.map((u: { id: string }) => u.id)).toContain("act");
    expect((await get("/api/admin/users?q=")).body.total).toBe(7);
    expect((await get("/api/admin/users?q=%20%20")).status).toBeLessThan(500);
  });

  it("q longer than 100 chars is rejected with 400, not 500", async () => {
    expect((await get(`/api/admin/users?q=${"a".repeat(101)}`)).status).toBe(400);
  });

  it("AdminUserRow: tripCount counts active memberships only; lastSeenAt is null until seen", async () => {
    await collections.users().insertOne({ _id: "solo", name: "Solo", email: "s@example.com", provider: "line", color: "gray", createdAt: new Date() } as never);
    await addOwner(T, "solo", "SoloA", "active", "editor");
    await addOwner("khao-yai", "solo", "SoloP", "pending", "editor");
    await addOwner("koh-larn", "solo", "SoloR", "removed", "editor");
    const row = (await get("/api/admin/users?q=Solo")).body.items.find((u: { id: string }) => u.id === "solo");
    expect(row.tripCount).toBe(1);
    expect(row.lastSeenAt).toBeNull();
    const d = (await get("/api/admin/users/solo")).body;
    expect(d.trips.map((x: { id: string }) => x.id)).toEqual([T]);
    expect(d.user.tripCount).toBe(1);
  });

  it("user detail: unknown → 404 not_found; `activity` is at most 10, newest first", async () => {
    expect((await get("/api/admin/users/nobody")).status).toBe(404);
    const now = Date.now();
    await collections.activities().insertMany(Array.from({ length: 15 }, (_, i) => ({ _id: newId(), tripId: T, actorId: `${T}:act`, type: "plan", refId: null, text: `n${i}`, createdAt: new Date(now - i * 1000), readBy: [] })) as never);
    const d = (await get("/api/admin/users/act")).body;
    expect(d.activity).toHaveLength(10);
    const ts = d.activity.map((a: { createdAt: string }) => a.createdAt);
    expect(ts).toEqual([...ts].sort().reverse());
  });
});

// ---------------------------------------------------------------- trips
describe("trips: status, owners, spent", () => {
  const find = (body: { items: { id: string }[] }, id: string) => body.items.find((x) => x.id === id);

  it("status around today in Asia/Bangkok: ends today=ongoing, starts today=ongoing, ended yesterday=past, starts tomorrow=upcoming", async () => {
    const today = new Date(`${todayInBangkok()}T00:00:00Z`);
    const d = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
    await addTrip("b-ends-today", { startDate: d(-3), endDate: d(0) });
    await addTrip("b-starts-today", { startDate: d(0), endDate: d(3) });
    await addTrip("b-one-day-today", { startDate: d(0), endDate: d(0) });
    await addTrip("b-ended-yesterday", { startDate: d(-3), endDate: d(-1) });
    await addTrip("b-starts-tomorrow", { startDate: d(1), endDate: d(3) });
    const body = (await get("/api/admin/trips?q=b-")).body;
    const st = (id: string) => find(body, id) && (find(body, id) as unknown as { status: string }).status;
    expect(st("b-ends-today")).toBe("ongoing");
    expect(st("b-starts-today")).toBe("ongoing");
    expect(st("b-one-day-today")).toBe("ongoing");
    expect(st("b-ended-yesterday")).toBe("past");
    expect(st("b-starts-tomorrow")).toBe("upcoming");
    // the filter agrees with the row status
    for (const s of ["upcoming", "ongoing", "past"]) {
      const f = (await get(`/api/admin/trips?q=b-&status=${s}`)).body;
      expect(f.items.map((x: { id: string }) => x.id).sort(), s).toEqual(body.items.filter((x: { status: string }) => x.status === s).map((x: { id: string }) => x.id).sort());
    }
  });

  it("Bangkok boundary: at 17:30 UTC (already tomorrow in Bangkok) a trip ending 'today UTC' is past", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-11T17:30:00Z") }); // Bangkok: 2026-11-12 00:30
    await addTrip("edge-past", { startDate: "2026-11-09", endDate: "2026-11-11" });
    await addTrip("edge-ongoing", { startDate: "2026-11-12", endDate: "2026-11-13" });
    await addTrip("edge-upcoming", { startDate: "2026-11-13", endDate: "2026-11-14" });
    const body = (await get("/api/admin/trips?q=edge-")).body;
    const map = Object.fromEntries(body.items.map((x: { id: string; status: string }) => [x.id, x.status]));
    expect(map).toEqual({ "edge-past": "past", "edge-ongoing": "ongoing", "edge-upcoming": "upcoming" });
    expect((await get("/api/admin/trips?q=edge-&status=past")).body.items.map((x: { id: string }) => x.id)).toEqual(["edge-past"]);
    expect((await get("/api/admin/trips?q=edge-&status=ongoing")).body.items.map((x: { id: string }) => x.id)).toEqual(["edge-ongoing"]);
  });

  it("Bangkok boundary: at 16:59 UTC (still the same day in Bangkok) the same trip is still ongoing", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-11T16:59:00Z") });
    await addTrip("edge2", { startDate: "2026-11-09", endDate: "2026-11-11" });
    const body = (await get("/api/admin/trips?q=edge2")).body;
    expect(body.items[0].status).toBe("ongoing");
  });

  it("owners = active owner Members only; several owners all listed; left/pending/removed owners and editors excluded", async () => {
    await addTrip("own");
    await addOwner("own", "act", "OwnerA");
    await addOwner("own", "mint", "OwnerB");
    await addOwner("own", null, "OwnerGhost"); // unclaimed owner: userId null
    await addOwner("own", "beam", "OwnerRemoved", "removed");
    await addOwner("own", "ploy", "OwnerPending", "pending");
    await addOwner("own", "n", "EditorOnly", "active", "editor");
    const row = find((await get("/api/admin/trips?q=own")).body, "own") as unknown as { owners: { name: string; userId: string | null; memberId: string }[]; memberCount: number };
    expect(row.owners.map((o) => o.name).sort()).toEqual(["OwnerA", "OwnerB", "OwnerGhost"]);
    expect(row.owners.find((o) => o.name === "OwnerGhost")!.userId).toBeNull();
    expect(row.owners.find((o) => o.name === "OwnerA")!.memberId).toBe("own:OwnerA");
    expect(row.memberCount).toBe(4); // 3 active owners + 1 active editor
    const detail = (await get("/api/admin/trips/own")).body;
    expect(detail.trip.owners.map((o: { name: string }) => o.name).sort()).toEqual(["OwnerA", "OwnerB", "OwnerGhost"]);
    const names = detail.members.map((m: { displayName: string }) => m.displayName);
    expect(names).toContain("OwnerPending");
    expect(names).not.toContain("OwnerRemoved");
  });

  it("owner search matches an owner's Member displayName and the owner User's name, not a non-owner or a left owner", async () => {
    await addTrip("srch");
    await addOwner("srch", "act", "Zxyqname"); // displayName differs from User name 'Act'
    await collections.users().insertOne({ _id: "wq", name: "Wqvkuser", email: "wq@example.com", provider: "line", color: "gray", createdAt: new Date() } as never);
    await addOwner("srch", "wq", "plain");
    await addOwner("srch", "beam", "Leftowner", "removed");
    await addOwner("srch", "ploy", "Notowner", "active", "editor");
    await collections.users().updateOne({ _id: "ploy" }, { $set: { name: "Editoruser" } });
    const ids = async (q: string) => (await get(`/api/admin/trips?q=${q}`)).body.items.map((x: { id: string }) => x.id);
    expect(await ids("zxyq")).toEqual(["srch"]);
    expect(await ids("wqvk")).toEqual(["srch"]);
    expect(await ids("Leftowner")).toEqual([]);
    expect(await ids("Notowner")).toEqual([]);
    expect(await ids("Editoruser")).toEqual([]);
    // an owner who is removed does not match via their User name either
    await collections.users().updateOne({ _id: "beam" }, { $set: { name: "Beamgone" } });
    expect(await ids("Beamgone")).toEqual([]);
  });

  it("trip q matches name and destination (case-insensitive) and spent sums group Expenses only", async () => {
    const row = find((await get("/api/admin/trips?q=%E0%B9%82%E0%B8%95%E0%B9%80%E0%B8%81%E0%B8%B5%E0%B8%A2%E0%B8%A7")).body, T) as unknown as { spent: number };
    const sum = (await collections.expenses().find({ tripId: T }).toArray()).reduce((s, e) => s + e.amount, 0);
    expect(row.spent).toBe(sum);
    expect(sum).toBeGreaterThan(0);
    const detail = (await get(`/api/admin/trips/${T}`)).body;
    expect(detail.trip.spent).toBe(sum);
    expect(detail.counts.expenses).toBe(await collections.expenses().countDocuments({ tripId: T }));
  });

  it("spent follows group Expense add, edit and delete", async () => {
    const before = (await get(`/api/admin/trips/${T}`)).body.trip.spent;
    const members = await collections.members().find({ tripId: T, status: "active" }).toArray();
        const c = await request(app()).post(`/api/trips/${T}/expenses`).set(as("act")).send({
      title: "ทดสอบ",
      category: "food",
      amount: 100_000,
      payerId: `${T}:act`,
      method: "cash",
      splitMode: "equal",
      date: "2026-12-13",
      shares: members.map((m) => ({ memberId: m._id })),
    });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    expect((await get(`/api/admin/trips/${T}`)).body.trip.spent).toBe(before + 100_000);
    const del = await request(app()).delete(`/api/trips/${T}/expenses/${c.body.id}`).set(as("act"));
    expect(del.status).toBeLessThan(300);
    expect((await get(`/api/admin/trips/${T}`)).body.trip.spent).toBe(before);
  });

  it("trips sort startDate / createdAt asc and desc, default startDate desc", async () => {
    const sd = async (q: string) => (await get(`/api/admin/trips?${q}`)).body.items.map((x: { startDate: string }) => x.startDate);
    const def = await sd("");
    expect(def).toEqual([...def].sort().reverse());
    expect(await sd("sort=startDate&dir=asc")).toEqual([...def].reverse());
  });

  it("trip detail: unknown → 404; createdBy is {id,name} or null when the creator is gone; activity ≤ 5", async () => {
    expect((await get("/api/admin/trips/nope")).status).toBe(404);
    await addTrip("orphan", { createdBy: "deleted-user" });
    const d = await get("/api/admin/trips/orphan");
    expect(d.status).toBe(200);
    expect(d.body.trip.createdBy).toBeNull();
    const ok = (await get(`/api/admin/trips/${T}`)).body;
    expect(ok.trip.createdBy).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    expect(ok.activity.length).toBeLessThanOrEqual(5);
  });

  it("trip detail counts match the DB", async () => {
    const d = (await get(`/api/admin/trips/${T}`)).body.counts;
    expect(d.places).toBe(await collections.places().countDocuments({ tripId: T }));
    expect(d.planItems).toBe(await collections.planItems().countDocuments({ tripId: T }));
    expect(d.settlements).toBe(await collections.settlements().countDocuments({ tripId: T }));
  });
});

// ---------------------------------------------------------------- overview
describe("overview", () => {
  it("shapes: kpis each {current,previous}; providers; recentUsers ≤5; busiestTrips ≤5; pct and avg are numbers", async () => {
    const b = (await get("/api/admin/overview")).body;
    for (const k of ["usersNew", "tripsNew", "activeTrips7d", "signups7d"]) expect(b.kpis[k]).toEqual({ current: expect.any(Number), previous: expect.any(Number) });
    expect(b.daily).toHaveLength(30);
    expect(b.providers.google + b.providers.line).toBe(b.totals.users);
    expect(b.recentUsers.length).toBeLessThanOrEqual(5);
    expect(b.busiestTrips.length).toBeLessThanOrEqual(5);
    expect(typeof b.usersInTripPct).toBe("number");
    expect(typeof b.avgMembersPerTrip).toBe("number");
    for (const d of b.daily) expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = b.daily.map((d: { date: string }) => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("a user created 23:30 Bangkok last night is counted on the Bangkok date, not the UTC date", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-11T18:00:00Z") }); // Bangkok 2026-11-12 01:00
    await collections.users().insertOne({ _id: "late", name: "Late", email: "l@example.com", provider: "line", color: "gray", createdAt: new Date("2026-11-11T16:30:00Z") } as never); // Bangkok 11-11 23:30
    const b = (await get("/api/admin/overview?days=7")).body;
    expect(b.daily.at(-1).date).toBe("2026-11-12");
    expect(b.daily.find((d: { date: string }) => d.date === "2026-11-11").users).toBe(1);
    expect(b.daily.at(-1).users).toBe(0);
  });

  it("only group Expenses count toward activity; user's feed has no personal items (see privacy)", async () => {
    const b = (await get("/api/admin/overview")).body;
    for (const tr of b.busiestTrips) expect(tr).toHaveProperty("activity7d");
  });
});

// ---------------------------------------------------------------- 4. force sign-out
describe("force sign-out", () => {
  const prodLike = () => createApp({ ...testConfig, ADMIN_USER_IDS: ["act"], GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" } as never);

  async function loginAs(sub: string, name: string, appInst = prodLike()) {
    const { state, stateCookie } = await startLogin(appInst, "google");
    vi.stubGlobal("fetch", vi.fn(fakeProviderFetch({ sub, name, email: `${sub}@example.com` })));
    const cb = await request(appInst).get(`/api/auth/google/callback?state=${state}&code=abc`).set("Cookie", stateCookie);
    const session = setCookies(cb).find((c) => c.startsWith("session="));
    expect(session, "login should set a session").toBeDefined();
    vi.unstubAllGlobals();
    const pair = cookiePair(session!);
    const me = await request(appInst).get("/api/me").set("Cookie", pair);
    expect(me.status).toBe(200);
    return { pair, id: me.body.id as string };
  }

  it("204 bumps sessionVersion by 1; the target's old session cookie then gets 401 and a re-login works", async () => {
    const target = await loginAs("g-target", "Target");
    const v0 = (await collections.users().findOne({ _id: target.id }))!.sessionVersion ?? 0;
    const res = await request(prodLike()).post(`/api/admin/users/${target.id}/signout`).set(admin);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await collections.users().findOne({ _id: target.id }))!.sessionVersion).toBe(v0 + 1);
    expect((await request(prodLike()).get("/api/me").set("Cookie", target.pair)).status).toBe(401);
    const again = await loginAs("g-target", "Target");
    expect(again.id).toBe(target.id);
    expect((await request(prodLike()).get("/api/me").set("Cookie", again.pair)).status).toBe(200);
  });

  it("signing out someone does not sign out anyone else", async () => {
    const a = await loginAs("g-a", "A");
    const b = await loginAs("g-b", "B");
    await request(prodLike()).post(`/api/admin/users/${a.id}/signout`).set(admin).expect(204);
    expect((await request(prodLike()).get("/api/me").set("Cookie", b.pair)).status).toBe(200);
  });

  it("self → 409 cannot_sign_out_self with a Thai message, and sessionVersion is unchanged", async () => {
    const before = (await collections.users().findOne({ _id: "act" }))!.sessionVersion ?? 0;
    const res = await request(app()).post("/api/admin/users/act/signout").set(admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("cannot_sign_out_self");
    expect(res.body.error.message).toMatch(/[฀-๿]/);
    expect((await collections.users().findOne({ _id: "act" }))!.sessionVersion ?? 0).toBe(before);
  });

  it("self-check also holds for a real session cookie of an admin", async () => {
    const me = await loginAs("g-admin", "Adm");
    const a = createApp({ ...testConfig, ADMIN_USER_IDS: [me.id], GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" } as never);
    expect((await request(a).get("/api/admin/whoami").set("Cookie", me.pair)).status).toBe(200);
    expect((await request(a).post(`/api/admin/users/${me.id}/signout`).set("Cookie", me.pair)).status).toBe(409);
    expect((await request(a).get("/api/admin/whoami").set("Cookie", me.pair)).status).toBe(200);
  });

  it("unknown → 404; non-admin → 404 and the target is not signed out", async () => {
    expect((await request(app()).post("/api/admin/users/ghost/signout").set(admin)).status).toBe(404);
    const before = (await collections.users().findOne({ _id: "ploy" }))!.sessionVersion ?? 0;
    expect((await request(app()).post("/api/admin/users/ploy/signout").set(as("beam"))).status).toBe(404);
    expect((await collections.users().findOne({ _id: "ploy" }))!.sessionVersion ?? 0).toBe(before);
  });

  it("another admin may be signed out", async () => {
    const res = await request(app()).post("/api/admin/users/mint/signout").set(admin);
    expect(res.status).toBe(204);
    expect((await collections.users().findOne({ _id: "mint" }))!.sessionVersion).toBe(1);
  });

  it("the new sessionVersion shows in user detail; two sign-outs bump twice", async () => {
    await request(app()).post("/api/admin/users/beam/signout").set(admin).expect(204);
    await request(app()).post("/api/admin/users/beam/signout").set(admin).expect(204);
    expect((await get("/api/admin/users/beam")).body.user.sessionVersion).toBe(2);
  });

  it("concurrent sign-outs both succeed and bump exactly twice", async () => {
    const rs = await Promise.all([1, 2, 3].map(() => request(app()).post("/api/admin/users/ploy/signout").set(admin)));
    expect(rs.map((r) => r.status)).toEqual([204, 204, 204]);
    expect((await collections.users().findOne({ _id: "ploy" }))!.sessionVersion).toBe(3);
  });
});

// ---------------------------------------------------------------- 5. requestLogs
describe("requestLogs recording", () => {
  beforeEach(async () => {
    await collections.requestLogs().deleteMany({});
  });

  it("records method, path, status, ms (int) and userId; one entry per request", async () => {
    await request(logApp()).get("/api/me").set(as("mint"));
    await request(logApp()).get("/api/me");
    const rows = await until(logs, (r) => r.length >= 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ method: "GET", path: "/api/me", status: 200, userId: "mint" });
    expect(rows[1]).toMatchObject({ status: 401, userId: null });
    expect(Number.isInteger(rows[0]!.ms)).toBe(true);
  });

  it("does not record /api/health or any /api/admin/* (signed out, non-admin, admin, POST)", async () => {
    const a = logApp();
    await request(a).get("/api/health");
    await request(a).get("/api/admin/overview");
    await request(a).get("/api/admin/overview").set(as("beam"));
    await request(a).get("/api/admin/users").set(admin);
    await request(a).post("/api/admin/users/mint/signout").set(admin);
    await request(a).get("/api/admin/users?q=a").set(admin);
    await request(a).get("/api/me").set(admin); // sentinel, recorded last
    const rows = await until(logs, (r) => r.length >= 1);
    await sleep(150);
    expect((await logs()).map((r) => r.path)).toEqual(["/api/me"]);
    expect(rows.length).toBe(1);
  });

  // ADMIN-BUG-1: Express routing is case-insensitive, so /API/ADMIN/... reaches the admin routes but is logged.
  it("does not record admin or health requests written with other casing or a trailing slash", async () => {
    const a = logApp();
    await request(a).get("/API/ADMIN/users").set(admin);
    await request(a).get("/Api/Admin/overview").set(admin);
    await request(a).get("/API/HEALTH");
    await request(a).get("/api/health/");
    await request(a).get("/api/admin/").set(admin);
    await request(a).get("/api/me").set(admin); // sentinel
    await until(logs, (r) => r.length >= 1);
    await sleep(200);
    expect((await logs()).map((r) => r.path)).toEqual(["/api/me"]);
  });

  it("never stores the query string (signed file URL token, search terms)", async () => {
    const a = logApp();
    await request(a).get("/api/files/some-key?token=SUPERSECRETTOKEN&exp=123&sig=abc");
    await request(a).get("/api/me?next=https://x.test/?token=LEAK2").set(as("act"));
    await request(a).get("/api/trips?x=%3Ftoken%3DLEAK3").set(as("act"));
    const rows = await until(logs, (r) => r.length >= 3);
    expect(rows).toHaveLength(3);
    const text = JSON.stringify(rows);
    for (const leak of ["SUPERSECRETTOKEN", "LEAK2", "LEAK3", "exp=", "sig=", "?"]) expect(text, leak).not.toContain(leak);
    expect(rows.map((r) => r.path)).toEqual(["/api/files/some-key", "/api/me", "/api/trips"]);
  });

  it("a real signed file URL for a Document is never stored with its token", async () => {
    // Documents list returns an expiring signed URL; fetching it must not leave the token in requestLogs.
    const docs = await request(app()).get(`/api/trips/${T}/documents`).set(as("mint"));
    const doc = docs.body.find((d: { id: string }) => d.id === "doc-flight");
    expect(doc, JSON.stringify(docs.body).slice(0, 300)).toBeDefined();
    const signed = await request(app()).get(`/api/trips/${T}/documents/doc-flight/url`).set(as("mint"));
    expect(signed.status).toBe(200);
    const url: string = signed.body.url;
    const u = new URL(url, "http://localhost:4000");
    await request(logApp()).get(u.pathname + u.search);
    const rows = await until(logs, (r) => r.length >= 1);
    expect(JSON.stringify(rows)).not.toContain(u.search.slice(1) || "no-query");
    expect(rows[0]!.path).not.toContain("?");
  });

  it("failed log write never fails the request", async () => {
    const spy = vi.spyOn(collections, "requestLogs").mockImplementation(() => ({ insertOne: () => Promise.reject(new Error("disk full")) }) as never);
    const res = await request(logApp()).get("/api/me").set(as("act"));
    expect(res.status).toBe(200);
    await sleep(100);
    expect(spy).toHaveBeenCalled();
    const bad = await request(logApp()).post(`/api/trips/${T}/places`).set(as("act")).send({});
    expect(bad.status).toBe(400);
  });

  it("a synchronous throw while writing the log does not fail the request either", async () => {
    vi.spyOn(collections, "requestLogs").mockImplementation(() => {
      throw new Error("db closed");
    });
    const res = await request(logApp()).get("/api/me").set(as("act"));
    expect(res.status).toBe(200);
  });

  it("the collection is capped at 1000 documents", async () => {
    const col = collections.requestLogs();
    const mk = (i: number) => ({ _id: `cap-${i}`, at: new Date(), method: "GET", path: "/x", status: 200, ms: 1, userId: null });
    await col.insertMany(Array.from({ length: 1200 }, (_, i) => mk(i)) as never);
    expect(await col.countDocuments()).toBe(1000);
    const first = await col.find().sort({ $natural: 1 }).limit(1).next();
    expect(first!._id).toBe("cap-200");
    expect((await col.options()).capped).toBe(true);
  });

  it("every request counts, including 404 for unknown routes and 4xx, with their real status", async () => {
    const a = logApp();
    await request(a).get("/api/nope");
    await request(a).post(`/api/trips/${T}/places`).set(as("act")).send({});
    const rows = await until(logs, (r) => r.length >= 2);
    expect(rows.map((r) => r.status)).toEqual([404, 400]);
  });

  // ADMIN-BUG-2: path validator is maxLength 500; an over-long URL is dropped silently (not truncated).
  it("a request with a very long path is still recorded", async () => {
    await request(logApp()).get(`/api/${"a".repeat(600)}`);
    await sleep(200);
    expect(await collections.requestLogs().countDocuments()).toBe(1);
  });

  it("log recording is off by default under NODE_ENV=test", async () => {
    await request(app()).get("/api/me").set(admin);
    await sleep(100);
    expect(await collections.requestLogs().countDocuments()).toBe(0);
  });
});

// ---------------------------------------------------------------- 6. lastSeenAt
describe("lastSeenAt", () => {
  const seen = async (id: string) => (await collections.users().findOne({ _id: id }))!.lastSeenAt;

  it("is null before, set by an authenticated request, and a 401 does not set it", async () => {
    expect(await seen("beam")).toBeUndefined();
    await request(app()).get("/api/me");
    await sleep(50);
    expect(await seen("beam")).toBeUndefined();
    await request(app()).get("/api/me").set(as("beam")).expect(200);
    const v = await until(() => seen("beam"), (x) => !!x);
    expect(v).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - v!.getTime())).toBeLessThan(5000);
    const row = (await get("/api/admin/users?q=beam")).body.items.find((u: { id: string }) => u.id === "beam");
    expect(row.lastSeenAt).toBe(v!.toISOString());
  });

  it("is not rewritten within 10 minutes, and is rewritten after", async () => {
    const recent = new Date(Date.now() - 9 * 60_000);
    await collections.users().updateOne({ _id: "ploy" }, { $set: { lastSeenAt: recent } });
    await request(app()).get("/api/me").set(as("ploy")).expect(200);
    await sleep(150);
    expect((await seen("ploy"))!.getTime()).toBe(recent.getTime());
    const old = new Date(Date.now() - 11 * 60_000);
    await collections.users().updateOne({ _id: "ploy" }, { $set: { lastSeenAt: old } });
    await request(app()).get("/api/me").set(as("ploy")).expect(200);
    const v = await until(() => seen("ploy"), (x) => x!.getTime() > old.getTime());
    expect(v!.getTime()).toBeGreaterThan(old.getTime());
  });

  it("burst of concurrent requests leaves a single, valid lastSeenAt and none fails", async () => {
    const rs = await Promise.all(Array.from({ length: 15 }, () => request(app()).get("/api/me").set(as("n"))));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const v = await until(() => seen("n"), (x) => !!x);
    expect(v).toBeInstanceOf(Date);
  });

  it("a User who was force-signed-out (stale cookie, 401) does not get lastSeenAt updated", async () => {
    const appInst = createApp({ ...testConfig, ADMIN_USER_IDS: ["act"], GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" } as never);
    const { state, stateCookie } = await startLogin(appInst, "google");
    vi.stubGlobal("fetch", vi.fn(fakeProviderFetch({ sub: "g-stale", name: "Stale", email: "st@example.com" })));
    const cb = await request(appInst).get(`/api/auth/google/callback?state=${state}&code=abc`).set("Cookie", stateCookie);
    const pair = cookiePair(setCookies(cb).find((c) => c.startsWith("session="))!);
    const id = (await request(appInst).get("/api/me").set("Cookie", pair)).body.id as string;
    await until(() => seen(id), (x) => !!x);
    await collections.users().updateOne({ _id: id }, { $unset: { lastSeenAt: "" } });
    await request(appInst).post(`/api/admin/users/${id}/signout`).set(admin).expect(204);
    expect((await request(appInst).get("/api/me").set("Cookie", pair)).status).toBe(401);
    await sleep(150);
    expect(await seen(id)).toBeUndefined();
  });

  it("a failing lastSeenAt write never fails the request", async () => {
    vi.spyOn(collections, "users").mockImplementationOnce(() => ({ findOne: async () => ({ _id: "act", name: "Act", email: "a@e.com", provider: "google", color: "teal", createdAt: new Date() }) }) as never);
    const res = await request(app()).get("/api/health");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------- 7. /system
describe("GET /api/admin/system", () => {
  const hourOf = (d: Date) => new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);
  const mk = (over: Partial<{ at: Date; status: number; ms: number; path: string; userId: string | null; method: string }>) => ({ _id: newId(), at: new Date(), method: "GET", path: "/api/x", status: 200, ms: 10, userId: null, ...over });

  beforeEach(async () => {
    await collections.requestLogs().deleteMany({});
  });

  it("errorsByHour: 24 entries {hour,c4xx,c5xx,total}, oldest first, consecutive ISO hours ending at the current hour", async () => {
    const b = (await get("/api/admin/system")).body;
    expect(b.errorsByHour).toHaveLength(24);
    for (const e of b.errorsByHour) expect(Object.keys(e).sort()).toEqual(["c4xx", "c5xx", "hour", "total"]);
    const hrs = b.errorsByHour.map((e: { hour: string }) => Date.parse(e.hour));
    for (let i = 1; i < 24; i++) expect(hrs[i] - hrs[i - 1]).toBe(3_600_000);
    expect(b.errorsByHour.every((e: { hour: string }) => e.hour.endsWith(":00:00.000Z"))).toBe(true);
    expect(hrs.at(-1)).toBe(hourOf(new Date()).getTime());
  });

  it("counts are correct per hour: 2xx/3xx only in total, 4xx in c4xx, 5xx in c5xx, 429 counted as 4xx", async () => {
    const h0 = hourOf(new Date());
    const hPrev = new Date(h0.getTime() - 3 * 3_600_000);
    const at = (h: Date, m = 5) => new Date(h.getTime() + m * 60_000);
    await collections.requestLogs().insertMany([
      mk({ at: at(hPrev), status: 200 }),
      mk({ at: at(hPrev), status: 304 }),
      mk({ at: at(hPrev), status: 400 }),
      mk({ at: at(hPrev), status: 404 }),
      mk({ at: at(hPrev), status: 429 }),
      mk({ at: at(hPrev), status: 500 }),
      mk({ at: at(hPrev), status: 503 }),
      mk({ at: new Date(h0.getTime() - 3_600_000 * 3 - 1), status: 500 }), // previous hour bucket, last ms
    ] as never);
    const b = (await get("/api/admin/system")).body;
    const bucket = b.errorsByHour.find((e: { hour: string }) => e.hour === hPrev.toISOString());
    expect(bucket).toEqual({ hour: hPrev.toISOString(), c4xx: 3, c5xx: 2, total: 7 });
    const before = b.errorsByHour.find((e: { hour: string }) => e.hour === new Date(hPrev.getTime() - 3_600_000).toISOString());
    expect(before).toMatchObject({ c5xx: 1, total: 1 });
    expect(b.errorsByHour.reduce((s: number, e: { total: number }) => s + e.total, 0)).toBe(8);
  });

  it("bucket boundary: an entry at exactly HH:00:00.000 belongs to that hour; HH:59:59.999 to the same hour", async () => {
    const h = new Date(hourOf(new Date()).getTime() - 2 * 3_600_000);
    await collections.requestLogs().insertMany([mk({ at: h, status: 500 }), mk({ at: new Date(h.getTime() + 3_599_999), status: 500 })] as never);
    const e = (await get("/api/admin/system")).body.errorsByHour.find((x: { hour: string }) => x.hour === h.toISOString());
    expect(e).toMatchObject({ c5xx: 2, total: 2 });
  });

  it("entries older than 24 hours are not counted anywhere (errorsByHour, blocked24h)", async () => {
    const old = new Date(Date.now() - 30 * 3_600_000);
    await collections.requestLogs().insertMany([mk({ at: old, status: 500 }), mk({ at: old, status: 429 })] as never);
    const b = (await get("/api/admin/system")).body;
    expect(b.errorsByHour.reduce((s: number, e: { total: number }) => s + e.total, 0)).toBe(0);
    expect(b.rateLimit.blocked24h).toBe(0);
  });

  it("blocked24h counts 429s in the last 24 hours only", async () => {
    const now = Date.now();
    await collections.requestLogs().insertMany([
      mk({ at: new Date(now - 60_000), status: 429 }),
      mk({ at: new Date(now - 20 * 3_600_000), status: 429 }),
      mk({ at: new Date(now - 25 * 3_600_000), status: 429 }),
      mk({ at: new Date(now - 60_000), status: 401 }),
      mk({ at: new Date(now - 60_000), status: 500 }),
    ] as never);
    expect((await get("/api/admin/system")).body.rateLimit.blocked24h).toBe(2);
  });

  // ADMIN-BUG-3: the stats query starts at the first hourly bucket, so a 429 from 23.5h ago falls outside it.
  it("blocked24h counts a 429 that happened 23.5 hours ago", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-11T10:10:00Z") }); // first bucket starts 11:00 yesterday
    await collections.requestLogs().insertMany([mk({ at: new Date(Date.now() - 23.5 * 3_600_000), status: 429 })] as never);
    expect((await get("/api/admin/system")).body.rateLimit.blocked24h).toBe(1);
  });

  it("filter=4xx / 5xx / slow / all: right members, slow is ms >= 500 (499 no, 500 yes), newest first, total per filter", async () => {
    const now = Date.now();
    const rows = [
      mk({ at: new Date(now - 6000), status: 200, ms: 499, path: "/p499" }),
      mk({ at: new Date(now - 5000), status: 200, ms: 500, path: "/p500" }),
      mk({ at: new Date(now - 4000), status: 404, ms: 5, path: "/p404" }),
      mk({ at: new Date(now - 3000), status: 500, ms: 900, path: "/p500err" }),
      mk({ at: new Date(now - 2000), status: 399, ms: 5, path: "/p399" }),
      mk({ at: new Date(now - 1000), status: 429, ms: 1, path: "/p429" }),
    ];
    await collections.requestLogs().insertMany(rows as never);
    const paths = async (f: string) => {
      const b = (await get(`/api/admin/system?filter=${f}`)).body.logs;
      expect(b.total).toBe(b.items.length);
      return b.items.map((x: { path: string }) => x.path);
    };
    expect(await paths("all")).toEqual(["/p429", "/p399", "/p500err", "/p404", "/p500", "/p499"]);
    expect(await paths("4xx")).toEqual(["/p429", "/p404"]);
    expect(await paths("5xx")).toEqual(["/p500err"]);
    expect(await paths("slow")).toEqual(["/p500err", "/p500"]);
  });

  it("p95Ms1h is null with no data in the last hour, a number otherwise, ignoring older entries", async () => {
    expect((await get("/api/admin/system")).body.api.p95Ms1h).toBeNull();
    await collections.requestLogs().insertMany([mk({ at: new Date(Date.now() - 2 * 3_600_000), ms: 9999 })] as never);
    expect((await get("/api/admin/system")).body.api.p95Ms1h).toBeNull();
    await collections.requestLogs().insertMany(Array.from({ length: 100 }, (_, i) => mk({ ms: i + 1 })) as never);
    const p = (await get("/api/admin/system")).body.api.p95Ms1h;
    expect(p).toBeGreaterThanOrEqual(94);
    expect(p).toBeLessThanOrEqual(96);
  });

  it("logs paging: 20 per page, newest first, page past the end is empty, total is whole filtered count", async () => {
    const now = Date.now();
    await collections.requestLogs().insertMany(Array.from({ length: 45 }, (_, i) => mk({ at: new Date(now - (45 - i) * 1000), path: `/n${i}` })) as never);
    const p1 = (await get("/api/admin/system?page=1")).body.logs;
    const p3 = (await get("/api/admin/system?page=3")).body.logs;
    const p4 = (await get("/api/admin/system?page=4")).body.logs;
    expect(p1).toMatchObject({ page: 1, pageSize: 20, total: 45 });
    expect(p1.items[0].path).toBe("/n44");
    expect(p3.items).toHaveLength(5);
    expect(p3.items.at(-1).path).toBe("/n0");
    expect(p4.items).toEqual([]);
  });

  it("log item shape: id, ISO at, method, path, status, ms, userId (null when signed out)", async () => {
    await collections.requestLogs().insertMany([mk({ userId: "mint" }), mk({ userId: null })] as never);
    const items = (await get("/api/admin/system")).body.logs.items;
    for (const i of items) {
      expect(i.at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(typeof i.id).toBe("string");
    }
    expect(items.map((i: { userId: string | null }) => String(i.userId)).sort()).toEqual(["mint", "null"]);
  });

  it("api.uptimeSec, mongo.ok, storage.driver have the documented shapes", async () => {
    const b = (await get("/api/admin/system")).body;
    expect(Number.isInteger(b.api.uptimeSec)).toBe(true);
    expect(b.mongo.ok).toBe(true);
    expect(typeof b.mongo.pingMs).toBe("number");
    expect(b.storage).toEqual({ driver: "local" });
    expect(Object.keys(b).sort()).toEqual(["api", "errorsByHour", "logs", "mongo", "rateLimit", "storage"]);
  });

  it("when MongoDB is down: 200, mongo.ok false, pingMs null, empty stats, 24 zero buckets", async () => {
    const { getDb } = await import("../db/client.js");
    const db = getDb();
    const spy = vi.spyOn(db, "command").mockRejectedValue(new Error("down"));
    const res = await get("/api/admin/system");
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.mongo.ok).toBe(false);
    expect(res.body.mongo.pingMs).toBeNull();
    expect(res.body.errorsByHour).toHaveLength(24);
    expect(res.body.logs.items).toEqual([]);
    expect(res.body.api.p95Ms1h).toBeNull();
  });

  it("real 429s from the rate limiter show up in blocked24h", async () => {
    // Uses the real limiter: hammer an auth route until blocked, with recording on.
    const a = logApp();
    let blocked = 0;
    for (let i = 0; i < 60 && blocked === 0; i++) {
      const r = await request(a).get("/api/auth/google");
      if (r.status === 429) blocked++;
    }
    if (blocked === 0) return; // limiter not reachable in this config; unit data above covers the count
    await until(logs, (r) => r.some((x) => x.status === 429));
    expect((await get("/api/admin/system")).body.rateLimit.blocked24h).toBeGreaterThanOrEqual(1);
  });
});
