/**
 * QA: trips, Members, invites, Join + Claim (API.md A1–A5, B1–B11).
 * Sources: SPEC "ทริป สมาชิก และบัญชี" / "สิทธิ์", first-backend.md "สิทธิ์" and "ลบทริป".
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, J, K, L, mid, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const M = (k: string) => mid(T, k);

beforeEach(() => t.reseed());

/** Creates an invite on khao-yai (owner Mint) and returns its token. */
async function khaoYaiInvite(requireApproval = false, expiresIn: "1d" | "7d" | "never" = "7d") {
  const res = await request(app()).put(`/api/trips/${K}/invite`).set(as("mint")).send({ expiresIn, requireApproval });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe("reads and shapes", () => {
  it("GET /api/me → User (id, name, email, provider, color), no providerSubject", async () => {
    const res = await request(app()).get("/api/me").set(as("ploy"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "ploy", name: "Ploy", provider: "line", color: "purple" });
    expect(res.body).not.toHaveProperty("providerSubject");
    expect(res.body).not.toHaveProperty("_id");
  });

  it("GET /api/trips → { trip, me, outstanding }[] sorted by startDate; only my trips", async () => {
    const res = await request(app()).get("/api/trips").set(as("beam"));
    expect(res.status).toBe(200);
    expect(res.body.map((r: { trip: { id: string } }) => r.trip.id).sort()).toEqual([L, T].sort());
    for (const r of res.body) {
      expectIdNotUnderscore(r.trip);
      expect(r.me.userId).toBe("beam");
      expect(Number.isInteger(r.outstanding)).toBe(true);
    }
    const tokyo = res.body.find((r: { trip: { id: string } }) => r.trip.id === T);
    expect(tokyo.outstanding).toBe(-580_000);
  });

  it("GET /api/trips/:tripId → { trip, me } and the trip carries no invite token", async () => {
    const res = await request(app()).get(`/api/trips/${T}`).set(as("mint"));
    expect(res.status).toBe(200);
    expect(res.body.me).toMatchObject({ id: M("mint"), role: "editor", tripId: T });
    expect(res.body.trip).toMatchObject({ id: T, baseCurrency: "THB", startDate: "2026-12-12", endDate: "2026-12-15", budget: 3_600_000 });
    expect(JSON.stringify(res.body)).not.toContain("tokyo-winter-7d-seed-invite");
  });

  it("GET members → Member[] with userId null for Unclaimed Members", async () => {
    const res = await request(app()).get(`/api/trips/${K}/members`).set(as("act"));
    expect(res.status).toBe(200);
    const kong = res.body.find((m: { id: string }) => m.id === mid(K, "kong"));
    expect(kong).toMatchObject({ userId: null, displayName: "Kong", role: "editor" });
    for (const m of res.body) expectIdNotUnderscore(m);
  });

  it("GET invite as owner → Invite with ISO expiresAt", async () => {
    const res = await request(app()).get(`/api/trips/${T}/invite`).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tripId: T, token: "tokyo-winter-7d-seed-invite", requireApproval: true });
    expect(new Date(res.body.expiresAt).toISOString()).toBe(res.body.expiresAt);
  });

  it("GET invite of a trip without one → null", async () => {
    const res = await request(app()).get(`/api/trips/${L}/invite`).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe("create / update / delete trip", () => {
  const body = { name: "ทริป QA", destination: "เชียงใหม่", startDate: "2027-01-10", endDate: "2027-01-12", cover: "teal", members: [{ displayName: "Kai" }] };

  it("POST /api/trips → 201 Trip; creator is owner, other names are Unclaimed Members", async () => {
    const res = await request(app()).post("/api/trips").set(as("ploy")).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "ทริป QA", createdBy: "ploy", baseCurrency: "THB", budget: null });
    const members = await request(app()).get(`/api/trips/${res.body.id}/members`).set(as("ploy"));
    const roles = members.body.map((m: { displayName: string; role: string; userId: string | null }) => [m.displayName, m.role, m.userId]);
    expect(roles).toEqual(expect.arrayContaining([["Ploy", "owner", "ploy"], ["Kai", "editor", null]]));
  });

  it("POST /api/trips with endDate before startDate → 400", async () => {
    expectError(await request(app()).post("/api/trips").set(as("ploy")).send({ ...body, startDate: "2027-01-12", endDate: "2027-01-10" }), 400);
  });

  it("POST /api/trips with an impossible calendar date (2027-02-30) → 400", async () => { // BUG-1
    expectError(await request(app()).post("/api/trips").set(as("ploy")).send({ ...body, startDate: "2027-02-30", endDate: "2027-03-02" }), 400);
  });

  it("POST /api/trips with a float budget / negative budget → 400", async () => {
    expectError(await request(app()).post("/api/trips").set(as("ploy")).send({ ...body, budget: 10.5 }), 400);
    expectError(await request(app()).post("/api/trips").set(as("ploy")).send({ ...body, budget: -1 }), 400);
  });

  it("POST /api/trips with extra field (createdBy) → 400", async () => {
    expectError(await request(app()).post("/api/trips").set(as("ploy")).send({ ...body, createdBy: "act" }), 400);
  });

  it("PATCH trip as owner → 200 Trip and an Activity", async () => {
    const n0 = await activityCount(T);
    const res = await request(app()).patch(`/api/trips/${T}`).set(as("act")).send({ name: "โตเกียว QA", meetingPoint: null });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("โตเกียว QA");
    expect(res.body).not.toHaveProperty("meetingPoint");
    expect(await activityCount(T)).toBe(n0 + 1);
  });

  it("PATCH legs outside the trip's days → 400", async () => {
    expectError(await request(app()).patch(`/api/trips/${J}`).set(as("act")).send({ legs: [{ city: "Tokyo", from: 1, to: 20 }] }), 400);
  });

  it("DELETE trip as owner → 204, data in every collection is gone, Tags stay", async () => {
    const tagsBefore = await collections.tags().countDocuments({});
    expect((await request(app()).delete(`/api/trips/${T}`).set(as("act"))).status).toBe(204);
    for (const name of ["members", "invites", "documents", "places", "planItems", "expenses", "settlements", "checklistItems", "activities"] as const) {
      expect(await collections[name]().countDocuments({ tripId: T }), name).toBe(0);
    }
    expect(await collections.trips().countDocuments({ _id: T })).toBe(0);
    expect(await collections.tags().countDocuments({})).toBe(tagsBefore);
    expectError(await request(app()).get(`/api/trips/${T}`).set(as("act")), 404);
    // other trips untouched
    expect(await collections.expenses().countDocuments({ tripId: K })).toBe(3);
  });

  it("the old invite link of a deleted trip → 404", async () => {
    await request(app()).delete(`/api/trips/${T}`).set(as("act"));
    expectError(await request(app()).get("/api/join/tokyo-winter-7d-seed-invite"), 404);
  });
});

describe("members (owner)", () => {
  it("add an Unclaimed Member → 201 Member with userId null + Activity", async () => {
    const n0 = await activityCount(T);
    const res = await request(app()).post(`/api/trips/${T}/members`).set(as("act")).send({ displayName: "Kai", role: "viewer" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: null, displayName: "Kai", role: "viewer", tripId: T });
    expect(await activityCount(T)).toBe(n0 + 1);
  });

  it("add with a blank name / unknown role / extra field → 400", async () => {
    for (const b of [{ displayName: "  " }, { displayName: "Kai", role: "admin" }, { displayName: "Kai", userId: "n" }]) {
      expectError(await request(app()).post(`/api/trips/${T}/members`).set(as("act")).send(b), 400);
    }
  });

  it("change role → 200; the new role takes effect (Ploy as viewer can't add a Place)", async () => {
    const res = await request(app()).patch(`/api/trips/${T}/members/${M("ploy")}`).set(as("act")).send({ role: "viewer" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("viewer");
    expectError(await request(app()).post(`/api/trips/${T}/places`).set(as("ploy")).send({ name: "x", type: "sight", city: "Tokyo" }), 403);
  });

  it("demoting the last owner → 409", async () => {
    expectError(await request(app()).patch(`/api/trips/${T}/members/${M("act")}`).set(as("act")).send({ role: "editor" }), 409);
  });

  it("removing the last owner → 409", async () => {
    expectError(await request(app()).delete(`/api/trips/${T}/members/${M("act")}`).set(as("act")), 409);
  });

  it("removing a Member with Outstanding ≠ 0 (Ploy −฿5,150) → 409", async () => {
    expectError(await request(app()).delete(`/api/trips/${T}/members/${M("ploy")}`).set(as("act")), 409);
  });

  it("removing a settled Member still named on Expenses (Mint) → 204 soft remove: gone from list, Expenses keep the id, can't access", async () => {
    expect((await request(app()).delete(`/api/trips/${T}/members/${M("mint")}`).set(as("act"))).status).toBe(204);
    const list = await request(app()).get(`/api/trips/${T}/members`).set(as("act"));
    expect(list.body.map((m: { id: string }) => m.id)).not.toContain(M("mint"));
    expect((await collections.members().findOne({ _id: M("mint") }))?.status).toBe("removed");
    expectError(await request(app()).get(`/api/trips/${T}`).set(as("mint")), 404);
    // Balances still add up
    const bal = await request(app()).get(`/api/trips/${T}/balances`).set(as("act"));
    expect(bal.body.total).toBe(3_035_000);
  });

  it("a soft-removed Member cannot come back through the invite link → 409", async () => {
    await request(app()).delete(`/api/trips/${T}/members/${M("mint")}`).set(as("act"));
    expectError(await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("mint")).send({ displayName: "Mint again" }), 409);
  });

  it("member of another trip → 404", async () => {
    expectError(await request(app()).patch(`/api/trips/${T}/members/${mid(K, "kong")}`).set(as("act")).send({ role: "viewer" }), 404);
    expectError(await request(app()).delete(`/api/trips/${T}/members/${mid(K, "kong")}`).set(as("act")), 404);
  });
});

describe("invite (owner)", () => {
  it("PUT invite 1d / 7d / never → expiresAt ≈ now+1d / now+7d / null", async () => {
    for (const [expiresIn, days] of [["1d", 1], ["7d", 7], ["never", null]] as const) {
      const res = await request(app()).put(`/api/trips/${L}/invite`).set(as("act")).send({ expiresIn, requireApproval: false });
      expect(res.status).toBe(200);
      if (days === null) expect(res.body.expiresAt).toBeNull();
      else expect(Math.abs(new Date(res.body.expiresAt).getTime() - Date.now() - days * 86_400_000)).toBeLessThan(60_000);
    }
  });

  it("PUT invite with an unknown expiresIn → 400", async () => {
    expectError(await request(app()).put(`/api/trips/${L}/invite`).set(as("act")).send({ expiresIn: "30d", requireApproval: false }), 400);
  });

  it("reset → a new token; the old one stops working (404)", async () => {
    const res = await request(app()).post(`/api/trips/${T}/invite/reset`).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body.token).not.toBe("tokyo-winter-7d-seed-invite");
    expectError(await request(app()).get("/api/join/tokyo-winter-7d-seed-invite"), 404);
    expect((await request(app()).get(`/api/join/${res.body.token}`)).status).toBe(200);
  });
});

describe("join + Claim", () => {
  it("preview (public): trip summary + Unclaimed Members with linked Expense count and Share total", async () => {
    const token = await khaoYaiInvite();
    const res = await request(app()).get(`/api/join/${token}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.trip).sort()).toEqual(["cover", "destination", "endDate", "name", "startDate"]);
    expect(res.body.members).toHaveLength(1);
    // Kong: in all 3 khao-yai Expenses; Shares 1,600 + 700 + 320
    expect(res.body.members[0]).toMatchObject({ member: { id: mid(K, "kong") }, expenseCount: 3, total: 262_000 });
  });

  it("preview of an unknown token → 404, expired token → 410", async () => {
    expectError(await request(app()).get("/api/join/no-such-token-xxxxxxxxxxxx"), 404);
    await collections.invites().updateOne({ _id: T }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expectError(await request(app()).get("/api/join/tokyo-winter-7d-seed-invite"), 410);
    expectError(await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("n")).send({ displayName: "N" }), 410);
  });

  it("Claim an Unclaimed Member → the User takes over that Member (same id) and its Expenses", async () => {
    const token = await khaoYaiInvite();
    const res = await request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ claimMemberId: mid(K, "kong") });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tripId: K, pending: false, member: { id: mid(K, "kong"), userId: "ploy" } });
    const trips = await request(app()).get("/api/trips").set(as("ploy"));
    const ky = trips.body.find((r: { trip: { id: string } }) => r.trip.id === K);
    expect(ky.me.id).toBe(mid(K, "kong"));
  });

  it("two Users claim the same Unclaimed Member at once → exactly one 200, the other 409", async () => {
    const token = await khaoYaiInvite();
    const [a, b] = await Promise.all([
      request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ claimMemberId: mid(K, "kong") }),
      request(app()).post(`/api/join/${token}`).set(as("beam")).send({ claimMemberId: mid(K, "kong") }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const kong = await collections.members().findOne({ _id: mid(K, "kong") });
    expect(["ploy", "beam"]).toContain(kong?.userId);
  });

  it("claiming an already-claimed Member → 409", async () => {
    expectError(
      await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("n")).send({ claimMemberId: M("mint") }),
      409,
    );
  });

  it("a Member of the trip joining again → 409", async () => {
    const token = await khaoYaiInvite();
    expectError(await request(app()).post(`/api/join/${token}`).set(as("act")).send({ displayName: "Act 2" }), 409);
    expectError(await request(app()).post(`/api/join/${token}`).set(as("act")).send({ claimMemberId: mid(K, "kong") }), 409);
    expect((await collections.members().findOne({ _id: mid(K, "kong") }))?.userId).toBeNull();
  });

  it("the same User joining twice at once → one success, one 409", async () => {
    const token = await khaoYaiInvite();
    const [a, b] = await Promise.all([
      request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ displayName: "Ploy" }),
      request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ displayName: "Ploy" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("claimMemberId of another trip → 404", async () => {
    const token = await khaoYaiInvite();
    expectError(await request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ claimMemberId: M("mint") }), [404, 409]);
  });

  it("body with both claimMemberId and displayName / neither → 400", async () => {
    const token = await khaoYaiInvite();
    expectError(await request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ claimMemberId: mid(K, "kong"), displayName: "x" }), 400);
    expectError(await request(app()).post(`/api/join/${token}`).set(as("ploy")).send({}), 400);
  });

  it("requireApproval → pending Member; no access until the owner approves; approve → 200, then access", async () => {
    // Tokyo invite requires approval.
    const res = await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("n")).send({ displayName: "N" });
    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);
    expectError(await request(app()).get(`/api/trips/${T}`).set(as("n")), 404);
    // editor cannot approve
    expectError(await request(app()).post(`/api/trips/${T}/members/${res.body.member.id}/approve`).set(as("mint")), 403);
    const ok = await request(app()).post(`/api/trips/${T}/members/${res.body.member.id}/approve`).set(as("act"));
    expect(ok.status).toBe(200);
    expect((await request(app()).get(`/api/trips/${T}`).set(as("n"))).status).toBe(200);
    // approve again → 409
    expectError(await request(app()).post(`/api/trips/${T}/members/${res.body.member.id}/approve`).set(as("act")), 409);
  });

  it("join adds a 'member' Activity", async () => {
    const token = await khaoYaiInvite();
    const n0 = await activityCount(K);
    await request(app()).post(`/api/join/${token}`).set(as("ploy")).send({ claimMemberId: mid(K, "kong") });
    expect(await activityCount(K)).toBe(n0 + 1);
  });

  it("pending Member via addN cannot read Tokyo (sanity for approve flow)", async () => {
    await addN("editor", "pending");
    expectError(await request(app()).get(`/api/trips/${T}/members`).set(as("n")), 404);
  });
});
