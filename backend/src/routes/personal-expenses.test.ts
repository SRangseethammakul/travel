/** Personal Expenses (B44–B47): private to the Current Member, any role, never part of group money. */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";
const P = `${T}/personal-expenses`;
const m = (k: string) => `tokyo-winter:${k}`;

// Seed Tokyo: act owner; mint, beam, ploy editors. Add N as a viewer.
beforeEach(async () => {
  await db.reseed();
  await collections.members().insertOne({
    _id: m("n"), tripId: "tokyo-winter", userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

const body = { title: "ของฝาก Don Quijote", category: "shopping", amount: 300_000, method: "card", date: "2026-12-13" };

describe("CRUD", () => {
  it("lists only my seeded records, sorted by date", async () => {
    const res = await request(app()).get(P).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual(["pe-coffee", "pe-donki", "pe-taxi"]);
    expect(res.body[1]).toEqual({
      id: "pe-donki",
      tripId: "tokyo-winter",
      ownerId: m("act"),
      title: "ของฝาก Don Quijote",
      category: "shopping",
      amount: 300_000,
      currency: "THB",
      baseAmount: 300_000,
      method: "card",
      date: "2026-12-13",
      createdAt: expect.any(String),
    });
    // Other Members see none of Act's records.
    expect((await request(app()).get(P).set(as("mint"))).body).toEqual([]);
  });

  it("create → edit → delete my own record, with no Activity", async () => {
    const activitiesBefore = await collections.activities().countDocuments({ tripId: "tokyo-winter" });

    const created = await request(app()).post(P).set(as("mint")).send({ ...body, note: "ฝากแม่" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...body, note: "ฝากแม่", ownerId: m("mint"), currency: "THB", baseAmount: 300_000 });
    const id = created.body.id as string;

    const edited = await request(app()).patch(`${P}/${id}`).set(as("mint")).send({ amount: 250_000, category: "food", note: null });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ amount: 250_000, baseAmount: 250_000, category: "food", updatedAt: expect.any(String) });
    expect(edited.body).not.toHaveProperty("note");

    expect((await request(app()).get(P).set(as("mint"))).body.map((r: { id: string }) => r.id)).toEqual([id]);
    expect((await request(app()).delete(`${P}/${id}`).set(as("mint"))).status).toBe(204);
    expect((await request(app()).get(P).set(as("mint"))).body).toEqual([]);

    expect(await collections.activities().countDocuments({ tripId: "tokyo-winter" })).toBe(activitiesBefore);
  });

  it("a viewer can create, edit and delete their own record", async () => {
    const created = await request(app()).post(P).set(as("n")).send(body);
    expect(created.status).toBe(201);
    expect(created.body.ownerId).toBe(m("n"));
    expect((await request(app()).patch(`${P}/${created.body.id}`).set(as("n")).send({ title: "ขนม" })).status).toBe(200);
    expect((await request(app()).delete(`${P}/${created.body.id}`).set(as("n"))).status).toBe(204);
  });
});

describe("privacy", () => {
  it("another Member's record is 404 on PATCH/DELETE, even for the trip owner", async () => {
    for (const user of ["mint", "n"]) {
      const patch = await request(app()).patch(`${P}/pe-donki`).set(as(user)).send({ title: "x" });
      expect(patch.status).toBe(404);
      expect(patch.body.error.code).toBe("personal_expense_not_found");
      expect((await request(app()).delete(`${P}/pe-donki`).set(as(user))).status).toBe(404);
    }
    const mine = await request(app()).post(P).set(as("mint")).send(body);
    expect((await request(app()).patch(`${P}/${mine.body.id}`).set(as("act")).send({ title: "x" })).status).toBe(404);
    expect((await request(app()).delete(`${P}/${mine.body.id}`).set(as("act"))).status).toBe(404);
    // Unchanged.
    expect((await collections.personalExpenses().findOne({ _id: "pe-donki" }))?.title).toBe("ของฝาก Don Quijote");
  });

  it("a record from another trip is 404 (ids are scoped to the trip in the URL)", async () => {
    expect((await request(app()).patch(`/api/trips/japan-spring/personal-expenses/pe-donki`).set(as("act")).send({ title: "x" })).status).toBe(404);
  });

  it("not a Member → 404; signed out → 401", async () => {
    expect((await request(app()).get(`/api/trips/khao-yai/personal-expenses`).set(as("beam"))).status).toBe(404);
    expect((await request(app()).post(`/api/trips/khao-yai/personal-expenses`).set(as("beam")).send(body)).status).toBe(404);
    expect((await request(app()).get(P)).status).toBe(401);
  });
});

describe("validation", () => {
  it.each([
    ["unknown category", { category: "souvenir" }],
    ["zero amount", { amount: 0 }],
    ["negative amount", { amount: -100 }],
    ["fractional satang", { amount: 100.5 }],
    ["blank title", { title: "  " }],
    ["unknown method", { method: "cheque" }],
    ["bad date", { date: "13/12/2026" }],
    ["payer field is not accepted", { payerId: m("act") }],
  ])("POST 400: %s", async (_name, change) => {
    const res = await request(app()).post(P).set(as("act")).send({ ...body, ...change });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_input");
  });

  it("date outside the trip → 400 date_outside_trip (POST and PATCH)", async () => {
    const post = await request(app()).post(P).set(as("act")).send({ ...body, date: "2026-12-16" });
    expect(post.status).toBe(400);
    expect(post.body.error.code).toBe("date_outside_trip");
    expect((await request(app()).patch(`${P}/pe-donki`).set(as("act")).send({ date: "2026-12-11" })).body.error.code).toBe("date_outside_trip");
  });

  it("PATCH with an empty body or a bad amount → 400", async () => {
    expect((await request(app()).patch(`${P}/pe-donki`).set(as("act")).send({})).status).toBe(400);
    expect((await request(app()).patch(`${P}/pe-donki`).set(as("act")).send({ amount: 0 })).status).toBe(400);
    expect((await request(app()).patch(`${P}/pe-donki`).set(as("act")).send({ category: "souvenir" })).status).toBe(400);
  });

  it("group Expenses still reject the shopping category", async () => {
    const res = await request(app()).post(`${T}/expenses`).set(as("act")).send({
      title: "ช็อป", category: "shopping", payerId: m("act"), method: "cash", date: "2026-12-13", amount: 10_000,
      shares: [{ memberId: m("act"), amount: 10_000 }],
    });
    expect(res.status).toBe(400);
  });
});

describe("group money is unchanged", () => {
  it("balances, summary, settlements and the trips list are the same after adding and removing personal records", async () => {
    const snapshot = async () => ({
      balances: (await request(app()).get(`${T}/balances`).set(as("act"))).body,
      summary: (await request(app()).get(`${T}/summary`).set(as("act"))).body,
      settlements: (await request(app()).get(`${T}/settlements`).set(as("act"))).body,
      expenses: (await request(app()).get(`${T}/expenses`).set(as("act"))).body,
      trips: (await request(app()).get(`/api/trips`).set(as("act"))).body,
    });
    // Drop the seeded personal records first so the "before" has none.
    await collections.personalExpenses().deleteMany({});
    const before = await snapshot();
    expect(before.balances).not.toHaveProperty("error");

    for (const user of ["act", "mint", "n"]) {
      expect((await request(app()).post(P).set(as(user)).send(body)).status).toBe(201);
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe("cleanup", () => {
  it("removing a Member (hard delete) deletes their personal records only", async () => {
    await request(app()).post(P).set(as("n")).send(body);
    expect(await collections.personalExpenses().countDocuments({ ownerId: m("n") })).toBe(1);
    expect((await request(app()).delete(`${T}/members/${m("n")}`).set(as("act"))).status).toBe(204);
    expect(await collections.personalExpenses().countDocuments({ ownerId: m("n") })).toBe(0);
    expect(await collections.personalExpenses().countDocuments({ ownerId: m("act") })).toBe(3);
  });

  it("deleting the trip deletes its personal records", async () => {
    expect((await request(app()).delete(T).set(as("act"))).status).toBe(204);
    expect(await collections.personalExpenses().countDocuments({ tripId: "tokyo-winter" })).toBe(0);
  });
});
