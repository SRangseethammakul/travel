/** Phase 2: trips, members, invites, join/Claim — success paths and every role. */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const T = "tokyo-winter";

// Seed Tokyo: act owner; mint, beam, ploy editors. Add N as a viewer for role tests.
beforeEach(async () => {
  await t.reseed();
  await collections.members().insertOne({
    _id: `${T}:n`,
    tripId: T,
    userId: "n",
    displayName: "N",
    role: "viewer",
    status: "active",
    color: "slate",
    createdAt: new Date(),
  });
});

/** owner, editor, viewer, not a member (beam is not in japan-spring; use "n" on khao-yai instead). */
const ROLES = { owner: "act", editor: "mint", viewer: "n" } as const;

describe("GET /api/me", () => {
  it("returns the signed-in User; 401 without one", async () => {
    const res = await request(app()).get("/api/me").set(as("act"));
    expect(res.body).toEqual({ id: "act", name: "Act", email: "act@example.com", provider: "google", color: "teal" });
    expect((await request(app()).get("/api/me")).status).toBe(401);
  });
});

describe("GET /api/trips", () => {
  it("lists my trips with my Outstanding, soonest first", async () => {
    const res = await request(app()).get("/api/trips").set(as("act"));
    expect(res.status).toBe(200);
    const byTrip = Object.fromEntries(res.body.map((r: { trip: { id: string }; outstanding: number }) => [r.trip.id, r.outstanding]));
    expect(byTrip).toEqual({ "tokyo-winter": 1_095_000, "japan-spring": 0, "khao-yai": -32_000, "koh-larn": 0 });
    const starts = res.body.map((r: { trip: { startDate: string } }) => r.trip.startDate);
    expect(starts).toEqual([...starts].sort());
  });

  it("filters by tab (the seed clock is not used here, so only check the split is complete)", async () => {
    const up = await request(app()).get("/api/trips?tab=upcoming").set(as("act"));
    const past = await request(app()).get("/api/trips?tab=past").set(as("act"));
    expect(up.body.length + past.body.length).toBe(4);
    expect((await request(app()).get("/api/trips?tab=later").set(as("act"))).status).toBe(400);
  });
});

describe("trip CRUD", () => {
  const body = {
    name: "ทริปใหม่",
    destination: "เชียงใหม่",
    startDate: "2027-01-10",
    endDate: "2027-01-12",
    cover: "teal",
    members: [{ displayName: "Kong" }],
  };

  it("POST creates the trip, owner Member, Unclaimed Members, template checklist and an Activity", async () => {
    const res = await request(app()).post("/api/trips").set(as("beam")).send(body);
    expect(res.status).toBe(201);
    const tripId = res.body.id as string;
    const members = await collections.members().find({ tripId }).toArray();
    expect(members.map((m) => [m.displayName, m.role, m.userId])).toEqual([
      ["Beam", "owner", "beam"],
      ["Kong", "editor", null],
    ]);
    expect(await collections.checklistItems().countDocuments({ tripId, scope: "group" })).toBeGreaterThan(0);
    expect(await collections.activities().countDocuments({ tripId })).toBe(1);
  });

  it("POST rejects bad dates and legs outside the trip", async () => {
    expect((await request(app()).post("/api/trips").set(as("act")).send({ ...body, endDate: "2027-01-01" })).status).toBe(400);
    const legs = [{ city: "Chiang Mai", from: 1, to: 5 }];
    expect((await request(app()).post("/api/trips").set(as("act")).send({ ...body, legs })).status).toBe(400);
  });

  it("GET returns { trip, me } for any Member; 404 for a non-member or unknown trip", async () => {
    const res = await request(app()).get(`/api/trips/${T}`).set(as("n"));
    expect(res.body.trip.id).toBe(T);
    expect(res.body.me.role).toBe("viewer");
    expect((await request(app()).get("/api/trips/khao-yai").set(as("n"))).status).toBe(404);
    expect((await request(app()).get("/api/trips/nope").set(as("act"))).status).toBe(404);
  });

  it("PATCH: owner only; null removes meetingPoint", async () => {
    for (const [role, user] of Object.entries(ROLES)) {
      const res = await request(app()).patch(`/api/trips/${T}`).set(as(user)).send({ name: "โตเกียว", meetingPoint: null });
      expect(res.status, role).toBe(role === "owner" ? 200 : 403);
    }
    const trip = await collections.trips().findOne({ _id: T });
    expect(trip?.name).toBe("โตเกียว");
    expect(trip?.meetingPoint).toBeUndefined();
    expect((await request(app()).patch("/api/trips/khao-yai").set(as("n")).send({ name: "x" })).status).toBe(404);
  });

  it("DELETE: owner only; removes the trip and everything in it", async () => {
    expect((await request(app()).delete(`/api/trips/${T}`).set(as("mint"))).status).toBe(403);
    expect((await request(app()).delete(`/api/trips/${T}`).set(as("n"))).status).toBe(403);
    expect((await request(app()).delete(`/api/trips/${T}`).set(as("act"))).status).toBe(204);
    for (const c of ["members", "places", "planItems", "expenses", "settlements", "checklistItems", "activities", "documents"] as const) {
      expect(await collections[c]().countDocuments({ tripId: T }), c).toBe(0);
    }
    expect(await collections.tags().countDocuments()).toBeGreaterThan(0);
    expect((await request(app()).get(`/api/trips/${T}`).set(as("act"))).status).toBe(404);
  });
});

describe("members", () => {
  it("GET lists Members for any Member; 404 for non-members", async () => {
    const res = await request(app()).get(`/api/trips/${T}/members`).set(as("n"));
    expect(res.body).toHaveLength(5);
    expect((await request(app()).get("/api/trips/khao-yai/members").set(as("n"))).status).toBe(404);
  });

  it("POST adds an Unclaimed Member (owner only)", async () => {
    for (const user of [ROLES.editor, ROLES.viewer]) {
      expect((await request(app()).post(`/api/trips/${T}/members`).set(as(user)).send({ displayName: "Ice" })).status).toBe(403);
    }
    const res = await request(app()).post(`/api/trips/${T}/members`).set(as("act")).send({ displayName: "Ice" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ displayName: "Ice", userId: null, role: "editor", status: "active" });
  });

  it("PATCH changes a role (owner only); demoting the last owner → 409", async () => {
    expect((await request(app()).patch(`/api/trips/${T}/members/${T}:mint`).set(as("mint")).send({ role: "owner" })).status).toBe(403);
    const ok = await request(app()).patch(`/api/trips/${T}/members/${T}:mint`).set(as("act")).send({ role: "viewer" });
    expect(ok.body.role).toBe("viewer");
    const last = await request(app()).patch(`/api/trips/${T}/members/${T}:act`).set(as("act")).send({ role: "editor" });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe("last_owner");
  });

  it("DELETE: owner only; Outstanding ≠ 0 → 409; last owner → 409; settled + referenced → soft remove; unreferenced → deleted", async () => {
    expect((await request(app()).delete(`/api/trips/${T}/members/${T}:n`).set(as("mint"))).status).toBe(403);
    expect((await request(app()).delete(`/api/trips/${T}/members/${T}:beam`).set(as("act"))).status).toBe(409);
    expect((await request(app()).delete(`/api/trips/${T}/members/${T}:act`).set(as("act"))).body.error.code).toBe("last_owner");

    // Mint is settled (Outstanding 0) but named by Expenses → soft remove.
    expect((await request(app()).delete(`/api/trips/${T}/members/${T}:mint`).set(as("act"))).status).toBe(204);
    expect((await collections.members().findOne({ _id: `${T}:mint` }))?.status).toBe("removed");
    expect((await request(app()).get(`/api/trips/${T}`).set(as("mint"))).status).toBe(404);

    // N has nothing linked → hard delete.
    expect((await request(app()).delete(`/api/trips/${T}/members/${T}:n`).set(as("act"))).status).toBe(204);
    expect(await collections.members().findOne({ _id: `${T}:n` })).toBeNull();
  });
});

describe("invite + join", () => {
  it("invite endpoints are owner only", async () => {
    for (const user of [ROLES.editor, ROLES.viewer]) {
      expect((await request(app()).get(`/api/trips/${T}/invite`).set(as(user))).status).toBe(403);
      expect((await request(app()).put(`/api/trips/${T}/invite`).set(as(user)).send({ expiresIn: "1d", requireApproval: false })).status).toBe(403);
      expect((await request(app()).post(`/api/trips/${T}/invite/reset`).set(as(user))).status).toBe(403);
    }
    expect((await request(app()).get("/api/trips/khao-yai/invite").set(as("n"))).status).toBe(404);
  });

  it("owner sets expiry, approval and resets the token", async () => {
    const set = await request(app()).put(`/api/trips/${T}/invite`).set(as("act")).send({ expiresIn: "never", requireApproval: false });
    expect(set.body).toMatchObject({ tripId: T, expiresAt: null, requireApproval: false });
    const reset = await request(app()).post(`/api/trips/${T}/invite/reset`).set(as("act"));
    expect(reset.body.token).not.toBe(set.body.token);
    expect((await request(app()).get(`/api/join/${set.body.token}`)).status).toBe(404);
    expect((await request(app()).get(`/api/join/${reset.body.token}`)).status).toBe(200);
  });

  it("expired invite → 410", async () => {
    await collections.invites().updateOne({ _id: T }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app()).get("/api/join/tokyo-winter-7d-seed-invite")).status).toBe(410);
  });

  it("preview lists Unclaimed Members with the Expenses linked to them", async () => {
    const owner = await request(app()).put("/api/trips/khao-yai/invite").set(as("mint")).send({ expiresIn: "7d", requireApproval: false });
    const res = await request(app()).get(`/api/join/${owner.body.token}`);
    expect(res.body.trip.name).toBe("เขาใหญ่สุดสัปดาห์");
    expect(res.body.members).toEqual([
      { member: expect.objectContaining({ id: "khao-yai:kong", displayName: "Kong" }), expenseCount: 3, total: 262_000 },
    ]);
  });

  it("two Users claiming the same name at once: one wins, the other gets 409", async () => {
    const owner = await request(app()).put("/api/trips/khao-yai/invite").set(as("mint")).send({ expiresIn: "7d", requireApproval: false });
    const claim = (user: string) =>
      request(app()).post(`/api/join/${owner.body.token}`).set(as(user)).send({ claimMemberId: "khao-yai:kong" });
    const results = await Promise.all([claim("beam"), claim("ploy")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    expect(winner.body).toMatchObject({ tripId: "khao-yai", pending: false, member: { id: "khao-yai:kong" } });
  });

  it("joining twice → 409; approval needed → pending until the owner approves", async () => {
    // Tokyo seed invite requires approval.
    expect((await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("act")).send({ displayName: "Act2" })).status).toBe(409);
    const joined = await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("ploy")).send({ displayName: "x" });
    expect(joined.status).toBe(409); // ploy is already a Member of Tokyo

    const owner = await request(app()).put("/api/trips/japan-spring/invite").set(as("act")).send({ expiresIn: "1d", requireApproval: true });
    const res = await request(app()).post(`/api/join/${owner.body.token}`).set(as("beam")).send({ displayName: "Beam" });
    expect(res.body.pending).toBe(true);
    expect((await request(app()).get("/api/trips/japan-spring").set(as("beam"))).status).toBe(404);

    const memberId = res.body.member.id as string;
    expect((await request(app()).post(`/api/trips/japan-spring/members/${memberId}/approve`).set(as("n"))).status).toBe(403);
    expect((await request(app()).post(`/api/trips/japan-spring/members/${memberId}/approve`).set(as("act"))).status).toBe(200);
    expect((await request(app()).get("/api/trips/japan-spring").set(as("beam"))).status).toBe(200);
    expect((await request(app()).post(`/api/trips/japan-spring/members/${memberId}/approve`).set(as("act"))).status).toBe(409);
  });

  it("reject: a pending Claim goes back to Unclaimed (claimable again); a pending newcomer is deleted", async () => {
    const invite = await request(app()).put("/api/trips/japan-spring/invite").set(as("act")).send({ expiresIn: "1d", requireApproval: true });
    const token = invite.body.token as string;
    const placeholder = await request(app()).post("/api/trips/japan-spring/members").set(as("act")).send({ displayName: "Real Friend" });
    const placeholderId = placeholder.body.id as string;

    const squat = await request(app()).post(`/api/join/${token}`).set(as("eva")).send({ claimMemberId: placeholderId });
    expect(squat.body.pending).toBe(true);
    const unclaimedIds = async () => ((await request(app()).get(`/api/join/${token}`)).body.members as { member: { id: string } }[]).map((m) => m.member.id);
    expect(await unclaimedIds()).not.toContain(placeholderId);

    const reject = (memberId: string, user = "act") => request(app()).post(`/api/trips/japan-spring/members/${memberId}/reject`).set(as(user));
    expect((await reject(placeholderId, "n")).status).toBe(403);
    const res = await reject(placeholderId);
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ id: placeholderId, userId: null, status: "active" });
    expect(res.body.member.claimedAt).toBeUndefined();
    expect(await unclaimedIds()).toContain(placeholderId);
    expect((await reject(placeholderId)).status).toBe(409);

    // eva can ask again (no leftover Member blocks them), this time under a new name; reject deletes it.
    const again = await request(app()).post(`/api/join/${token}`).set(as("eva")).send({ displayName: "Eva" });
    expect(again.status).toBe(200);
    expect((await reject(again.body.member.id)).body).toEqual({ member: null });
    expect((await reject(again.body.member.id)).status).toBe(404);
  });

  it("joining needs a signed-in User", async () => {
    expect((await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").send({ displayName: "x" })).status).toBe(401);
  });
});

describe("dev routes", () => {
  it("list Users and switch the mock User", async () => {
    expect((await request(app()).get("/api/dev/users")).body).toHaveLength(7);
    const res = await request(app()).post("/api/dev/login").send({ userId: "ploy" });
    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^mock-user=ploy/);
    expect((await request(app()).post("/api/dev/login").send({ userId: "zed" })).status).toBe(404);
  });

  it("are not mounted in production", async () => {
    const prod = createApp({ ...testConfig, NODE_ENV: "production" });
    expect((await request(prod).get("/api/dev/users")).status).toBe(404);
  });
});
