/**
 * QA: Places, Tags, Areas, Plan Items, Hops (API.md A7–A10, B15–B28).
 * Sources: SPEC "สถานที่และแผน", first-backend.md "สิทธิ์" (editor edits only own Place / Plan Item / Hop) and "Tag".
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { activityCount, expectError, expectIdNotUnderscore, J, mid, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const P = `/api/trips/${T}/places`;
const PLAN = `/api/trips/${T}/plan`;
const M = (k: string) => mid(T, k);
const newPlace = { name: "ร้านใหม่", type: "food", city: "Tokyo", area: "Ueno" };

beforeEach(() => t.reseed());

describe("Places — reads", () => {
  it("GET places → Place[] with id, tagIds, area null for ไม่ระบุย่าน", async () => {
    const res = await request(app()).get(P).set(as("beam"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    for (const p of res.body) expectIdNotUnderscore(p);
    expect(res.body.find((p: { id: string }) => p.id === "t-haneda").area).toBeNull();
  });

  it("filters: unscheduled=1 → the 3 Unscheduled Places (SPEC: ยังไม่จัดวัน 3 ที่)", async () => {
    const res = await request(app()).get(`${P}?unscheduled=1`).set(as("beam"));
    expect(res.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-cafe", "t-omoide", "t-tempura"]);
  });

  it("filters: area and tags", async () => {
    const area = await request(app()).get(`${P}?area=Asakusa`).set(as("beam"));
    expect(area.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-sensoji", "t-skytree", "t-tempura"]);
    const tags = await request(app()).get(`${P}?tags=tag-booking`).set(as("beam"));
    expect(tags.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-tempura", "t-yakiniku"]);
  });

  it("GET a Place of another trip → 404", async () => {
    expectError(await request(app()).get(`${P}/j-hotel`).set(as("act")), 404);
  });
});

describe("Places — writes and role matrix", () => {
  it("editor adds a Place → 201, createdBy = Current Member, Activity added", async () => {
    const n0 = await activityCount(T);
    const res = await request(app()).post(P).set(as("beam")).send(newPlace);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ createdBy: M("beam"), tripId: T, tagIds: [], note: "" });
    expect(await activityCount(T)).toBe(n0 + 1);
  });

  it("validation: missing name / unknown type / costPerPerson float / extra field → 400", async () => {
    for (const b of [{ ...newPlace, name: undefined }, { ...newPlace, type: "bar" }, { ...newPlace, costPerPerson: 10.5 }, { ...newPlace, createdBy: M("act") }]) {
      expectError(await request(app()).post(P).set(as("beam")).send(b), 400);
    }
  });

  it("a Tag id that is neither mine nor used in this trip → 400", async () => {
    // tag-soba belongs to N and is only used in japan-spring.
    expectError(await request(app()).post(P).set(as("act")).send({ ...newPlace, tagIds: ["tag-soba"] }), 400);
  });

  it("newTags creates Tags owned by the current User; reusing an existing name reuses its id", async () => {
    const res = await request(app()).post(P).set(as("beam")).send({ ...newPlace, newTags: ["ราเมง", "ใหม่เอี่ยม"] });
    expect(res.status).toBe(201);
    expect(res.body.tagIds).toContain("tag-ramen");
    const created = await collections.tags().findOne({ name: "ใหม่เอี่ยม" });
    expect(created?.ownerId).toBe("beam");
  });

  it("editor edits their own Place → 200", async () => {
    expect((await request(app()).patch(`${P}/t-cafe`).set(as("mint")).send({ note: "x" })).status).toBe(200);
  });

  it("editor cannot edit another Member's Place → 403", async () => {
    expectError(await request(app()).patch(`${P}/t-hotel`).set(as("mint")).send({ note: "x" }), 403);
  });

  it("editor cannot delete another Member's Place → 403", async () => {
    expectError(await request(app()).delete(`${P}/t-hotel`).set(as("mint")), 403);
  });

  it("owner edits and deletes another Member's Place → 200 / 204; its visits leave the plan", async () => {
    expect((await request(app()).patch(`${P}/t-shabu`).set(as("act")).send({ note: "x" })).status).toBe(200);
    expect((await request(app()).delete(`${P}/t-shabu`).set(as("act"))).status).toBe(204);
    expect(await collections.planItems().countDocuments({ tripId: T, placeId: "t-shabu" })).toBe(0);
  });

  it("deleting a Place a Transit starts/ends at → 409", async () => {
    expectError(await request(app()).delete(`${P}/t-haneda`).set(as("act")), 409);
  });

  it("PATCH / DELETE a Place of another trip → 404", async () => {
    expectError(await request(app()).patch(`${P}/j-hotel`).set(as("act")).send({ note: "x" }), 404);
    expectError(await request(app()).delete(`${P}/j-hotel`).set(as("act")), 404);
  });
});

describe("Areas (owner)", () => {
  it("rename an Area → { updatedPlaces } and an Activity", async () => {
    const n0 = await activityCount(T);
    const res = await request(app()).patch(`/api/trips/${T}/areas`).set(as("act")).send({ city: "Tokyo", from: "Asakusa", to: "อาซากุสะ" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedPlaces: 3 });
    expect(await activityCount(T)).toBe(n0 + 1);
  });
});

describe("Tags", () => {
  it("GET /api/me/tags → only my Tags", async () => {
    const res = await request(app()).get("/api/me/tags").set(as("n"));
    expect(res.body.map((x: { id: string }) => x.id).sort()).toEqual(["tag-soba", "tag-street"]);
    for (const tag of res.body) expect(tag.ownerId).toBe("n");
  });

  it("GET trip tags → every Tag used on a Place of this trip", async () => {
    const res = await request(app()).get(`/api/trips/${T}/tags`).set(as("ploy"));
    expect(res.body.map((x: { id: string }) => x.id)).toContain("tag-ramen");
    expect(res.body.map((x: { id: string }) => x.id)).not.toContain("tag-soba");
  });

  it("suggest → { mine, others }: my Tags first, then other Tags used in this trip", async () => {
    const res = await request(app()).get(`/api/trips/${J}/tags/suggest?q=`).set(as("n"));
    expect(res.status).toBe(200);
    expect(res.body.mine.every((x: { ownerId: string }) => x.ownerId === "n")).toBe(true);
    expect(res.body.others.every((x: { ownerId: string }) => x.ownerId !== "n")).toBe(true);
    expect(res.body.others.map((x: { id: string }) => x.id)).toContain("tag-ramen");
  });

  it("create a Tag → 201; same name again → 409", async () => {
    const a = await request(app()).post("/api/me/tags").set(as("beam")).send({ name: "ตลาด", group: "อาหาร" });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ ownerId: "beam", name: "ตลาด", group: "อาหาร" });
    expectError(await request(app()).post("/api/me/tags").set(as("beam")).send({ name: "ตลาด" }), 409);
  });

  it("only the Tag's owner can rename it → 403 for others", async () => {
    expectError(await request(app()).patch("/api/me/tags/tag-ramen").set(as("mint")).send({ name: "x" }), 403);
  });

  it("only the Tag's owner can delete it → 403 for others", async () => {
    expectError(await request(app()).delete("/api/me/tags/tag-ramen").set(as("mint")), 403);
  });

  it("deleting a Tag removes it from every Place (all trips) and returns the count", async () => {
    const res = await request(app()).delete("/api/me/tags/tag-ramen").set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removedFromPlaces: 4 });
    expect(await collections.places().countDocuments({ tagIds: "tag-ramen" })).toBe(0);
    const tags = await request(app()).get(`/api/trips/${T}/tags`).set(as("act"));
    expect(tags.body.map((x: { id: string }) => x.id)).not.toContain("tag-ramen");
  });

  // API.md B22: GET /api/me/tags/usage → { [tagId]: count } (BUG-4: doc changed to match the frontend's getTagUsage)
  it("B22 usage of my Tags → { tagId: n }", async () => { // BUG-4
    const res = await request(app()).get("/api/me/tags/usage").set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body["tag-ramen"]).toBe(4);
  });
});

describe("Plan — reads", () => {
  it("sorted by day, then time with untimed last, then insertion order (A10)", async () => {
    const res = await request(app()).get(`/api/trips/${J}/plan`).set(as("n"));
    expect(res.status).toBe(200);
    const day2 = res.body.filter((i: { day?: number }) => i.day === 2).map((i: { id: string }) => i.id);
    expect(day2).toEqual(["j-p4", "j-p5", "j-p3"]);
    for (const i of res.body) expectIdNotUnderscore(i);
  });

  it("transit items are typed: kind 'transit', LocalDateTime, docIds array", async () => {
    const res = await request(app()).get(PLAN).set(as("ploy"));
    const flight = res.body.find((i: { id: string }) => i.id === "t-flight-out");
    expect(flight).toMatchObject({ kind: "transit", departAt: "2026-12-12T00:30", docIds: ["doc-flight"] });
  });
});

describe("Plan — writes and role matrix", () => {
  it("editor adds one Place on several days → 201 PlacePlanItem[] (one per day), createdBy me", async () => {
    const res = await request(app()).post(`${PLAN}/places`).set(as("mint")).send({ placeId: "t-cafe", days: [2, 3], time: "15:00" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((i: { day: number }) => i.day)).toEqual([2, 3]);
    expect(res.body.every((i: { createdBy: string; kind: string }) => i.createdBy === M("mint") && i.kind === "place")).toBe(true);
  });

  it("day beyond the trip / day 0 / duplicate days / bad time → 400", async () => {
    for (const b of [{ placeId: "t-cafe", days: [5] }, { placeId: "t-cafe", days: [0] }, { placeId: "t-cafe", days: [1, 1] }, { placeId: "t-cafe", days: [1], time: "25:00" }]) {
      expectError(await request(app()).post(`${PLAN}/places`).set(as("mint")).send(b), 400);
    }
  });

  it("Place id from another trip → 400/404", async () => {
    expectError(await request(app()).post(`${PLAN}/places`).set(as("mint")).send({ placeId: "j-hotel", days: [1] }), [400, 404]);
  });

  it("editor cannot edit / delete / set the Hop of another Member's Plan Item → 403", async () => {
    expectError(await request(app()).patch(`${PLAN}/t-p1`).set(as("mint")).send({ time: "12:00" }), 403);
    expectError(await request(app()).delete(`${PLAN}/t-p1`).set(as("mint")), 403);
    expectError(await request(app()).put(`${PLAN}/t-p1/hop`).set(as("mint")).send({ mode: "walk" }), 403);
    expectError(await request(app()).delete(`${PLAN}/t-p1/hop`).set(as("mint")), 403);
  });

  it("editor edits, sets the Hop of, and deletes their own Plan Item", async () => {
    const created = await request(app()).post(`${PLAN}/places`).set(as("mint")).send({ placeId: "t-cafe", days: [2] });
    const id = created.body[0].id;
    const patched = await request(app()).patch(`${PLAN}/${id}`).set(as("mint")).send({ time: null, day: 3 });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ day: 3, time: null });
    const hop = await request(app()).put(`${PLAN}/${id}/hop`).set(as("mint")).send({ mode: "walk", minutes: 5 });
    expect(hop.status).toBe(200);
    expect(hop.body.travelToNext).toEqual({ mode: "walk", minutes: 5 });
    expect((await request(app()).delete(`${PLAN}/${id}`).set(as("mint"))).status).toBe(204);
  });

  it("owner edits another Member's Plan Item → 200", async () => {
    const created = await request(app()).post(`${PLAN}/places`).set(as("mint")).send({ placeId: "t-cafe", days: [2] });
    expect((await request(app()).patch(`${PLAN}/${created.body[0].id}`).set(as("act")).send({ note: "x" })).status).toBe(200);
  });

  it("transit: valid → 201; arriveAt before departAt → 400; links from another trip → 400", async () => {
    const tr = { mode: "train", fromText: "Tokyo", toText: "Kyoto", departAt: "2026-12-14T09:00", arriveAt: "2026-12-14T11:15" };
    const ok = await request(app()).post(`${PLAN}/transits`).set(as("beam")).send({ ...tr, docIds: ["doc-hotel"], expenseId: "e-subway" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ kind: "transit", createdBy: M("beam"), docIds: ["doc-hotel"], expenseId: "e-subway" });
    expectError(await request(app()).post(`${PLAN}/transits`).set(as("beam")).send({ ...tr, arriveAt: "2026-12-14T08:00" }), 400);
    expectError(await request(app()).post(`${PLAN}/transits`).set(as("beam")).send({ ...tr, expenseId: "k-resort" }), 400);
    expectError(await request(app()).post(`${PLAN}/transits`).set(as("beam")).send({ ...tr, docIds: ["no-doc"] }), 400);
    expectError(await request(app()).post(`${PLAN}/transits`).set(as("beam")).send({ ...tr, toPlaceId: "j-hotel" }), 400);
  });

  it("PATCH a visit with transit-only fields → 400", async () => {
    expectError(await request(app()).patch(`${PLAN}/t-p1`).set(as("act")).send({ bookingRef: "X" }), 400);
  });

  it("Plan Item of another trip → 404", async () => {
    expectError(await request(app()).patch(`${PLAN}/j-p1`).set(as("act")).send({ note: "x" }), 404);
    expectError(await request(app()).delete(`${PLAN}/j-p1`).set(as("act")), 404);
  });

  it("deleting an Expense linked to a Transit unlinks it", async () => {
    const tr = await request(app())
      .post(`${PLAN}/transits`)
      .set(as("beam"))
      .send({ mode: "bus", fromText: "A", toText: "B", departAt: "2026-12-14T09:00", arriveAt: "2026-12-14T10:00", expenseId: "e-subway" });
    await request(app()).delete(`/api/trips/${T}/expenses/e-subway`).set(as("beam"));
    const plan = await request(app()).get(PLAN).set(as("beam"));
    expect(plan.body.find((i: { id: string }) => i.id === tr.body.id).expenseId).toBeUndefined();
  });

  it("every plan write adds one 'plan' Activity (add, edit, hop, delete hop, delete)", async () => {
    let n = await activityCount(T);
    const created = await request(app()).post(`${PLAN}/places`).set(as("mint")).send({ placeId: "t-cafe", days: [2] });
    const id = created.body[0].id;
    expect(await activityCount(T)).toBe(++n);
    await request(app()).patch(`${PLAN}/${id}`).set(as("mint")).send({ time: "10:00" });
    expect(await activityCount(T)).toBe(++n);
    await request(app()).put(`${PLAN}/${id}/hop`).set(as("mint")).send({ mode: "walk" });
    expect(await activityCount(T)).toBe(++n);
    await request(app()).delete(`${PLAN}/${id}/hop`).set(as("mint"));
    expect(await activityCount(T)).toBe(++n);
    await request(app()).delete(`${PLAN}/${id}`).set(as("mint"));
    expect(await activityCount(T)).toBe(n + 1);
    const feed = await request(app()).get(`/api/trips/${T}/activity?type=plan`).set(as("act"));
    expect(feed.body.every((a: { type: string }) => a.type === "plan")).toBe(true);
  });

  it("City Legs: owner PATCH legs → 200 sorted legs; editor → 403 (first-backend.md: owner เท่านั้น)", async () => {
    const ok = await request(app()).patch(`/api/trips/${J}`).set(as("act")).send({ legs: [{ city: "Kyoto", from: 5, to: 6 }, { city: "Tokyo", from: 1, to: 4 }] });
    expect(ok.status).toBe(200);
    expect(ok.body.legs.map((l: { city: string }) => l.city)).toEqual(["Tokyo", "Kyoto"]);
    expectError(await request(app()).patch(`/api/trips/${J}`).set(as("n")).send({ legs: null }), 403);
  });
});
