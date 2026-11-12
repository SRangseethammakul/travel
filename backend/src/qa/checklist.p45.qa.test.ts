/**
 * QA phase 5 — Checklist (API.md A15, B35–B38). Sources: SPEC "เช็คลิสต์และความเคลื่อนไหว",
 * "โมเดลข้อมูลที่แนะนำ" (personal กรองด้วย ownerId ที่ backend), first-backend.md ช่วง 5.
 * Gaps beyond phase5.test.ts / auth.qa.test.ts.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { collections } from "../db/collections.js";
import { as } from "../test/helpers.js";
import { p45App, useP45Db } from "./p45-helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, J, K, mid, setMember, T } from "./qa-helpers.js";

const t = useP45Db("checklist");
const app = () => p45App();
const M = (k: string) => mid(T, k);
const api = `/api/trips/${T}/checklist`;

type Item = { id: string; scope: string; ownerId?: string; text: string; category: string; assigneeId?: string; done: boolean; doneBy?: string; fromTemplate: boolean };
const list = async (user: string, tripId = T) => (await request(app()).get(`/api/trips/${tripId}/checklist`).set(as(user))).body as Item[];

beforeEach(() => t.reseed());

describe("reads", () => {
  it("shape matches types.ts ChecklistItem", async () => {
    const items = await list("act");
    expect(items.length).toBe(14);
    for (const c of items) {
      expectIdNotUnderscore(c as unknown as Record<string, unknown>);
      expect(c).toMatchObject({ tripId: T, scope: expect.stringMatching(/^(group|personal)$/), text: expect.any(String), category: expect.any(String), done: expect.any(Boolean), fromTemplate: expect.any(Boolean) });
      if (c.scope === "personal") expect(c.ownerId).toBe(M("act"));
      if (c.scope === "group") expect(c.ownerId).toBeUndefined();
    }
  });

  it("the client cannot ask for someone else's personal items (?ownerId= / ?memberId= ignored)", async () => {
    for (const q of [`ownerId=${M("act")}`, `memberId=${M("act")}`, "scope=personal"]) {
      const res = await request(app()).get(`${api}?${q}`).set(as("mint"));
      expect(res.status === 200 || res.status === 400).toBe(true);
      if (res.status === 200) expect((res.body as Item[]).some((c) => c.scope === "personal" && c.ownerId !== M("mint"))).toBe(false);
    }
  });

  it("my personal items in one trip do not show up in another trip I am in", async () => {
    const created = await request(app()).post(api).set(as("act")).send({ scope: "personal", text: "ร่ม", category: "ของใช้" });
    expect(created.status).toBe(201);
    expect((await list("act", J)).some((c) => c.id === created.body.id)).toBe(false);
    expectError(await request(app()).patch(`/api/trips/${J}/checklist/${created.body.id}`).set(as("act")).send({ done: true }), 404);
  });

  it("a group item of another trip → 404 on PATCH and DELETE", async () => {
    // Act is a Member of Japan, but c-3 belongs to Tokyo.
    expectError(await request(app()).patch(`/api/trips/${J}/checklist/c-3`).set(as("act")).send({ done: true }), 404);
    expectError(await request(app()).delete(`/api/trips/${J}/checklist/c-3`).set(as("act")), 404);
  });
});

describe("create (B35)", () => {
  it("personal: ownerId is the Current Member, no Activity is shared about it", async () => {
    const before = await activityCount(T);
    const res = await request(app()).post(api).set(as("beam")).send({ scope: "personal", text: "ยาแก้แพ้", category: "ของใช้" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ scope: "personal", ownerId: M("beam"), done: false, fromTemplate: false });
    expect(await activityCount(T)).toBe(before);
    const feed = await request(app()).get(`/api/trips/${T}/activity`).set(as("act"));
    expect(JSON.stringify(feed.body)).not.toContain("ยาแก้แพ้");
  });

  const bad: [string, object][] = [
    ["client-sent ownerId", { scope: "personal", text: "x", category: "y", ownerId: M("act") }],
    ["client-sent done/doneBy", { scope: "group", text: "x", category: "y", done: true, doneBy: M("act") }],
    ["client-sent fromTemplate", { scope: "group", text: "x", category: "y", fromTemplate: true }],
    ["unknown scope", { scope: "team", text: "x", category: "y" }],
    ["blank text", { scope: "group", text: "   ", category: "y" }],
    ["text over 300 chars", { scope: "group", text: "ก".repeat(301), category: "y" }],
    ["missing category", { scope: "group", text: "x" }],
    ["personal with an assignee", { scope: "personal", text: "x", category: "y", assigneeId: M("mint") }],
    ["assignee from another trip", { scope: "group", text: "x", category: "y", assigneeId: mid(K, "kong") }],
    ["unknown assignee", { scope: "group", text: "x", category: "y", assigneeId: "nobody" }],
  ];
  for (const [name, body] of bad) {
    it(`${name} → 400`, async () => {
      const before = await activityCount(T);
      expectError(await request(app()).post(api).set(as("mint")).send(body), 400);
      expect(await activityCount(T)).toBe(before);
    });
  }

  it("removed Member as assignee → 400", async () => {
    await addN("editor", "removed");
    expectError(await request(app()).post(api).set(as("mint")).send({ scope: "group", text: "x", category: "y", assigneeId: M("n") }), 400);
  });

  // first-backend.md: requireMember passes only `active`; a pending Member is not in the trip yet.
  it("pending Member as assignee → 400", async () => { // BUG-B4
    await addN("editor", "pending");
    expectError(await request(app()).post(api).set(as("mint")).send({ scope: "group", text: "x", category: "y", assigneeId: M("n") }), 400);
  });

  it("PATCH: pending Member as assignee → 400", async () => { // BUG-B4
    await addN("editor", "pending");
    expectError(await request(app()).patch(`${api}/c-6`).set(as("mint")).send({ assigneeId: M("n") }), 400);
  });

  it("group as editor → 201 and one 'plan' Activity", async () => {
    const before = await activityCount(T);
    const res = await request(app()).post(api).set(as("ploy")).send({ scope: "group", text: "แลกเงินเยน", category: "เพิ่มเอง", assigneeId: M("beam") });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ scope: "group", assigneeId: M("beam"), done: false });
    expect(res.body.ownerId).toBeUndefined();
    expect(await activityCount(T)).toBe(before + 1);
  });
});

describe("update (B36)", () => {
  // Express/Mongo: an update with no operators is rejected by the driver.
  it("PATCH with an empty body → 400 (or 200 no-op), never 500", async () => { // BUG-B5
    const res = await request(app()).patch(`${api}/c-3`).set(as("mint")).send({});
    expect(res.status, JSON.stringify(res.body)).not.toBe(500);
    expect([200, 400]).toContain(res.status);
  });

  it("PATCH with an unknown field → 400", async () => {
    expectError(await request(app()).patch(`${api}/c-3`).set(as("mint")).send({ ownerId: M("mint") }), 400);
  });

  it("client cannot set doneBy; the server sets it to the Current Member", async () => {
    expectError(await request(app()).patch(`${api}/c-3`).set(as("mint")).send({ done: true, doneBy: M("act") }), 400);
    const res = await request(app()).patch(`${api}/c-3`).set(as("beam")).send({ done: true });
    expect(res.body).toMatchObject({ done: true, doneBy: M("beam") });
  });

  it("viewer can re-assign a group item (API.md B36: any for group tick/assign)", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const res = await request(app()).patch(`${api}/c-6`).set(as("ploy")).send({ assigneeId: M("ploy") });
    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(M("ploy"));
  });

  it("viewer cannot change the category of a group item → 403", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    expectError(await request(app()).patch(`${api}/c-6`).set(as("ploy")).send({ category: "อื่นๆ" }), 403);
  });

  it("owner of a personal item ticks it: doneBy = owner; un-tick clears doneBy", async () => {
    const mine = (await list("act")).find((c) => c.scope === "personal" && !c.done)!;
    const ticked = await request(app()).patch(`${api}/${mine.id}`).set(as("act")).send({ done: true });
    expect(ticked.body).toMatchObject({ done: true, doneBy: M("act") });
    const unticked = await request(app()).patch(`${api}/${mine.id}`).set(as("act")).send({ done: false });
    expect(unticked.body.done).toBe(false);
    expect(unticked.body.doneBy).toBeUndefined();
  });

  it("another Member's personal item stays 404 even for the trip owner", async () => {
    const res = await request(app()).post(api).set(as("ploy")).send({ scope: "personal", text: "ลับ", category: "ของใช้" });
    expectError(await request(app()).patch(`${api}/${res.body.id}`).set(as("act")).send({ text: "เปลี่ยน" }), 404);
    expectError(await request(app()).delete(`${api}/${res.body.id}`).set(as("act")), 404);
    expect((await list("act")).some((c) => c.id === res.body.id)).toBe(false);
  });
});

describe("default items (SPEC: รายการตั้งต้น)", () => {
  it("a new trip gets the group template once, plus the owner's personal template", async () => {
    const trip = await request(app()).post("/api/trips").set(as("beam")).send({
      name: "QA เช็คลิสต์", destination: "เชียงใหม่", startDate: "2027-01-10", endDate: "2027-01-12", cover: "teal", members: [{ displayName: "Gun" }],
    });
    expect(trip.status).toBe(201);
    const items = await list("beam", trip.body.id);
    const group = items.filter((c) => c.scope === "group");
    const personal = items.filter((c) => c.scope === "personal");
    expect(group.length).toBeGreaterThan(0);
    expect(personal.length).toBeGreaterThan(0);
    expect(items.every((c) => c.fromTemplate && !c.done)).toBe(true);
    expect(new Set(group.map((c) => c.text)).size).toBe(group.length);
    // The Unclaimed Member "Gun" has no personal items until someone claims him.
    expect(await collections.checklistItems().countDocuments({ tripId: trip.body.id, scope: "personal", ownerId: { $ne: personal[0]!.ownerId } })).toBe(0);
  });

  it("joining through the invite gives the new Member their own personal template, invisible to others", async () => {
    // Tokyo's seed invite needs approval; approve, then compare views.
    const join = await request(app()).post("/api/join/tokyo-winter-7d-seed-invite").set(as("n")).send({ displayName: "N" });
    expect(join.status).toBe(200);
    const memberId = join.body.member.id as string;
    expect((await request(app()).post(`/api/trips/${T}/members/${memberId}/approve`).set(as("act"))).status).toBe(200);
    const nItems = await list("n");
    const nPersonal = nItems.filter((c) => c.scope === "personal");
    expect(nPersonal.length).toBeGreaterThan(0);
    expect(nPersonal.every((c) => c.ownerId === memberId)).toBe(true);
    const actItems = await list("act");
    expect(actItems.some((c) => c.ownerId === memberId)).toBe(false);
  });
});

describe("delete (B37)", () => {
  it("owner deletes a group item → 204 and it is gone; second delete → 404", async () => {
    expect((await request(app()).delete(`${api}/c-8`).set(as("act"))).status).toBe(204);
    expect((await list("act")).some((c) => c.id === "c-8")).toBe(false);
    expectError(await request(app()).delete(`${api}/c-8`).set(as("act")), 404);
  });

  it("a viewer deletes their own personal item → 204", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const res = await request(app()).post(api).set(as("ploy")).send({ scope: "personal", text: "หมวก", category: "เสื้อผ้า" });
    expect(res.status).toBe(201);
    expect((await request(app()).delete(`${api}/${res.body.id}`).set(as("ploy"))).status).toBe(204);
  });
});

describe("suggestions (B38)", () => {
  it("no User → 401; missing scope → 400; personal list is { text, category }[]", async () => {
    expectError(await request(app()).get("/api/checklist/suggestions?scope=group"), 401);
    expectError(await request(app()).get("/api/checklist/suggestions").set(as("act")), 400);
    const res = await request(app()).get("/api/checklist/suggestions?scope=personal").set(as("n"));
    expect(res.status).toBe(200);
    for (const s of res.body) expect(Object.keys(s).sort()).toEqual(["category", "text"]);
  });
});
