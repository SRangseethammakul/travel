/**
 * QA: authentication, membership (404 never 403 for outsiders), and the role matrix of every
 * write endpoint. Sources: SPEC "สิทธิ์", first-backend.md "สิทธิ์", API.md Conventions.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { addN, expectError, J, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);

type Call = { method: "get" | "post" | "patch" | "put" | "delete"; path: string; body?: object };
const call = (c: Call, cookie?: Record<string, string>) => {
  const r = request(app())[c.method](c.path);
  if (cookie) r.set(cookie);
  return c.body ? r.send(c.body) : r;
};

const expenseBody = {
  title: "QA",
  category: "food",
  payerId: `${T}:act`,
  method: "cash",
  amount: 10_000,
  splitMode: "equal",
  shares: [{ memberId: `${T}:act` }, { memberId: `${T}:mint` }],
  date: "2026-12-12",
};

/** Every trip-scoped endpoint (reads and writes), with a plausible body. `:trip` is replaced. */
const tripEndpoints = (trip: string): Call[] => [
  { method: "get", path: `/api/trips/${trip}` },
  { method: "patch", path: `/api/trips/${trip}`, body: { name: "x" } },
  { method: "delete", path: `/api/trips/${trip}` },
  { method: "get", path: `/api/trips/${trip}/members` },
  { method: "post", path: `/api/trips/${trip}/members`, body: { displayName: "QA" } },
  { method: "get", path: `/api/trips/${trip}/invite` },
  { method: "put", path: `/api/trips/${trip}/invite`, body: { expiresIn: "7d", requireApproval: false } },
  { method: "get", path: `/api/trips/${trip}/documents` },
  { method: "get", path: `/api/trips/${trip}/places` },
  { method: "post", path: `/api/trips/${trip}/places`, body: { name: "QA", type: "sight", city: "Tokyo" } },
  { method: "get", path: `/api/trips/${trip}/tags` },
  { method: "get", path: `/api/trips/${trip}/tags/suggest?q=` },
  { method: "patch", path: `/api/trips/${trip}/areas`, body: { city: "Tokyo", from: "Shinjuku", to: "X" } },
  { method: "get", path: `/api/trips/${trip}/plan` },
  { method: "post", path: `/api/trips/${trip}/plan/places`, body: { placeId: "t-cafe", days: [1] } },
  { method: "get", path: `/api/trips/${trip}/expenses` },
  { method: "get", path: `/api/trips/${trip}/expenses/e-hotel` },
  { method: "post", path: `/api/trips/${trip}/expenses`, body: expenseBody },
  { method: "get", path: `/api/trips/${trip}/settlements` },
  { method: "post", path: `/api/trips/${trip}/settlements`, body: { toId: `${T}:act` } },
  { method: "post", path: `/api/trips/${trip}/settlements/s-beam/confirm` },
  { method: "get", path: `/api/trips/${trip}/balances` },
  { method: "get", path: `/api/trips/${trip}/summary` },
  { method: "get", path: `/api/trips/${trip}/checklist` },
  { method: "post", path: `/api/trips/${trip}/checklist`, body: { scope: "personal", text: "x", category: "y" } },
  { method: "get", path: `/api/trips/${trip}/activity` },
  { method: "post", path: `/api/trips/${trip}/activity/read`, body: {} },
];

const label = (c: Call) => `${c.method.toUpperCase()} ${c.path}`;

describe("no signed-in User → 401", () => {
  const globals: Call[] = [
    { method: "get", path: "/api/me" },
    { method: "get", path: "/api/trips" },
    { method: "post", path: "/api/trips", body: {} },
    { method: "get", path: "/api/me/tags" },
    { method: "post", path: "/api/me/tags", body: { name: "x" } },
    { method: "get", path: "/api/checklist/suggestions?scope=group" },
    { method: "post", path: "/api/join/tokyo-winter-7d-seed-invite", body: { displayName: "x" } },
  ];
  for (const c of [...globals, ...tripEndpoints(T)]) {
    it(`${label(c)} without a User → 401`, async () => {
      expectError(await call(c), 401);
    });
  }

  it("unknown mock-user id → 401", async () => {
    expectError(await request(app()).get("/api/me").set(as("nobody")), 401);
  });
});

describe("signed in but not a Member of the trip → 404 (never 403)", () => {
  // Beam is not a Member of japan-spring.
  for (const c of tripEndpoints(J)) {
    it(`${label(c)} as a non-Member → 404`, async () => {
      expectError(await call(c, as("beam")), 404);
    });
  }

  it("a trip id that does not exist → 404 with the same shape", async () => {
    expectError(await request(app()).get("/api/trips/no-such-trip").set(as("act")), 404);
  });
});

describe("pending and removed Members are treated as not Members", () => {
  beforeEach(() => t.reseed());

  for (const status of ["pending", "removed"] as const) {
    it(`${status} Member: reads → 404`, async () => {
      await addN("editor", status);
      for (const path of [`/api/trips/${T}`, `/api/trips/${T}/expenses`, `/api/trips/${T}/balances`, `/api/trips/${T}/checklist`]) {
        expectError(await request(app()).get(path).set(as("n")), 404);
      }
    });

    it(`${status} Member: writes → 404`, async () => {
      await addN("editor", status);
      expectError(await request(app()).post(`/api/trips/${T}/expenses`).set(as("n")).send(expenseBody), 404);
      expectError(await request(app()).post(`/api/trips/${T}/places`).set(as("n")).send({ name: "x", type: "sight", city: "Tokyo" }), 404);
    });

    it(`${status} Member: the trip is not in GET /api/trips`, async () => {
      await addN("editor", status);
      const res = await request(app()).get("/api/trips").set(as("n"));
      expect(res.status).toBe(200);
      expect(res.body.map((r: { trip: { id: string } }) => r.trip.id)).not.toContain(T);
    });
  }
});

describe("viewer cannot write (403) — SPEC สิทธิ์: ดูอย่างเดียว", () => {
  beforeEach(async () => {
    await t.reseed();
    await addN("viewer");
  });

  const viewerForbidden: Call[] = [
    { method: "patch", path: `/api/trips/${T}`, body: { name: "x" } },
    { method: "delete", path: `/api/trips/${T}` },
    { method: "post", path: `/api/trips/${T}/members`, body: { displayName: "QA" } },
    { method: "patch", path: `/api/trips/${T}/members/${T}:ploy`, body: { role: "viewer" } },
    { method: "delete", path: `/api/trips/${T}/members/${T}:mint` },
    { method: "get", path: `/api/trips/${T}/invite` },
    { method: "put", path: `/api/trips/${T}/invite`, body: { expiresIn: "7d", requireApproval: false } },
    { method: "post", path: `/api/trips/${T}/invite/reset` },
    { method: "post", path: `/api/trips/${T}/places`, body: { name: "QA", type: "sight", city: "Tokyo" } },
    { method: "patch", path: `/api/trips/${T}/places/t-cafe`, body: { note: "x" } },
    { method: "delete", path: `/api/trips/${T}/places/t-cafe` },
    { method: "patch", path: `/api/trips/${T}/areas`, body: { city: "Tokyo", from: "Shinjuku", to: "X" } },
    { method: "post", path: `/api/trips/${T}/plan/places`, body: { placeId: "t-cafe", days: [1] } },
    {
      method: "post",
      path: `/api/trips/${T}/plan/transits`,
      body: { mode: "train", fromText: "A", toText: "B", departAt: "2026-12-13T10:00", arriveAt: "2026-12-13T11:00" },
    },
    { method: "patch", path: `/api/trips/${T}/plan/t-p1`, body: { time: "12:00" } },
    { method: "put", path: `/api/trips/${T}/plan/t-p1/hop`, body: { mode: "walk" } },
    { method: "delete", path: `/api/trips/${T}/plan/t-p1/hop` },
    { method: "delete", path: `/api/trips/${T}/plan/t-p1` },
    { method: "post", path: `/api/trips/${T}/expenses`, body: expenseBody },
    { method: "patch", path: `/api/trips/${T}/expenses/e-hotel`, body: { title: "x" } },
    { method: "delete", path: `/api/trips/${T}/expenses/e-hotel` },
    { method: "post", path: `/api/trips/${T}/checklist`, body: { scope: "group", text: "x", category: "y" } },
    { method: "patch", path: `/api/trips/${T}/checklist/c-6`, body: { text: "renamed" } },
    { method: "delete", path: `/api/trips/${T}/checklist/c-6` },
    { method: "delete", path: `/api/trips/${T}/documents/doc-flight` },
  ];
  for (const c of viewerForbidden) {
    it(`viewer ${label(c)} → 403`, async () => {
      expectError(await call(c, as("n")), 403);
    });
  }

  it("viewer can read every trip resource (200)", async () => {
    for (const path of ["", "/members", "/documents", "/places", "/tags", "/plan", "/expenses", "/settlements", "/balances", "/summary", "/checklist", "/activity"]) {
      const res = await request(app()).get(`/api/trips/${T}${path}`).set(as("n"));
      expect(res.status, path).toBe(200);
    }
  });

  it("viewer can tick a group checklist item (SPEC: กลุ่ม ติ๊กได้ทุกคน)", async () => {
    const res = await request(app()).patch(`/api/trips/${T}/checklist/c-6`).set(as("n")).send({ done: true });
    expect(res.status).toBe(200);
    expect(res.body.doneBy).toBe(`${T}:n`);
  });
});

describe("editor cannot do owner-only actions (403)", () => {
  beforeEach(() => t.reseed());

  const ownerOnly: Call[] = [
    { method: "patch", path: `/api/trips/${T}`, body: { name: "x" } },
    { method: "patch", path: `/api/trips/${T}`, body: { legs: [{ city: "Tokyo", from: 1, to: 4 }] } },
    { method: "delete", path: `/api/trips/${T}` },
    { method: "post", path: `/api/trips/${T}/members`, body: { displayName: "QA" } },
    { method: "patch", path: `/api/trips/${T}/members/${T}:ploy`, body: { role: "viewer" } },
    { method: "delete", path: `/api/trips/${T}/members/${T}:ploy` },
    { method: "get", path: `/api/trips/${T}/invite` },
    { method: "put", path: `/api/trips/${T}/invite`, body: { expiresIn: "7d", requireApproval: false } },
    { method: "post", path: `/api/trips/${T}/invite/reset` },
    // first-backend.md: เปลี่ยนชื่อ/รวม Area — owner เท่านั้น (API.md B23 says editor+; see spec questions)
    { method: "patch", path: `/api/trips/${T}/areas`, body: { city: "Tokyo", from: "Shinjuku", to: "X" } },
  ];
  for (const c of ownerOnly) {
    it(`editor ${label(c)} → 403`, async () => {
      expectError(await call(c, as("mint")), 403);
    });
  }
});

describe("error shape", () => {
  it("unknown route → 404 { error: { code, message } }", async () => {
    expectError(await request(app()).get("/api/nope").set(as("act")), 404);
  });

  it("malformed JSON body → 400 { error: { code, message } }", async () => {
    const res = await request(app())
      .post(`/api/trips/${T}/expenses`)
      .set(as("act"))
      .set("Content-Type", "application/json")
      .send('{"title": ');
    expectError(res, 400);
  });
});
