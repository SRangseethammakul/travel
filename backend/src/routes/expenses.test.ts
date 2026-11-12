import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";
const m = (k: string) => `tokyo-winter:${k}`;

beforeEach(async () => {
  await db.reseed();
  await collections.members().insertOne({
    _id: m("n"), tripId: "tokyo-winter", userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

const base = { title: "ข้าวเช้า", category: "food", payerId: m("mint"), method: "cash", date: "2026-12-14" };

describe("GET expenses", () => {
  it("lists by date then createdAt, for owner and editor", async () => {
    for (const user of ["act", "ploy"]) {
      const res = await request(app()).get(`${T}/expenses`).set(as(user));
      expect(res.status).toBe(200);
      expect(res.body.map((e: { id: string }) => e.id)).toEqual(["e-hotel", "e-subway", "e-ramen", "e-skytree", "e-shabu"]);
    }
    expect((await request(app()).get(`${T}/expenses/e-hotel`).set(as("ploy"))).body).toMatchObject({ amount: 2_200_000, currency: "THB", baseAmount: 2_200_000 });
  });

  it("a viewer sees every Expense of the trip, list and detail", async () => {
    const res = await request(app()).get(`${T}/expenses`).set(as("n"));
    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual(["e-hotel", "e-subway", "e-ramen", "e-skytree", "e-shabu"]);
    expect((await request(app()).get(`${T}/expenses/e-hotel`).set(as("n"))).body).toMatchObject({ id: "e-hotel", amount: 2_200_000 });
  });

  it("404 for a non-Member or an unknown Expense", async () => {
    expect((await request(app()).get("/api/trips/khao-yai/expenses").set(as("ploy"))).status).toBe(404);
    expect((await request(app()).get(`${T}/expenses/nope`).set(as("act"))).status).toBe(404);
  });
});

describe("POST expenses", () => {
  it("equal: leftover satang goes to the payer; Activity recorded", async () => {
    const res = await request(app())
      .post(`${T}/expenses`)
      .set(as("mint"))
      .send({ ...base, amount: 10_001, splitMode: "equal", shares: [{ memberId: m("act") }, { memberId: m("mint") }, { memberId: m("ploy") }] });
    expect(res.status).toBe(201);
    expect(res.body.shares).toEqual([
      { memberId: m("act"), amount: 3333 },
      { memberId: m("mint"), amount: 3335 },
      { memberId: m("ploy"), amount: 3333 },
    ]);
    expect(res.body).toMatchObject({ currency: "THB", baseAmount: 10_001, createdBy: m("mint") });
    const activity = await collections.activities().findOne({ refId: res.body.id });
    expect(activity?.text).toBe('เพิ่มค่าใช้จ่าย "ข้าวเช้า" ฿100.01');
  });

  it("shares: weights; leftover to the first listed when the payer does not share", async () => {
    const res = await request(app())
      .post(`${T}/expenses`)
      .set(as("act"))
      .send({ ...base, amount: 1000, splitMode: "shares", shares: [{ memberId: m("beam"), weight: 2 }, { memberId: m("ploy"), weight: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.shares).toEqual([
      { memberId: m("beam"), amount: 667, weight: 2 },
      { memberId: m("ploy"), amount: 333, weight: 1 },
    ]);
  });

  it("amount: must sum exactly, otherwise 400", async () => {
    const send = (a: number) =>
      request(app()).post(`${T}/expenses`).set(as("act")).send({ ...base, amount: 1000, splitMode: "amount", shares: [{ memberId: m("act"), amount: 600 }, { memberId: m("mint"), amount: a }] });
    expect((await send(300)).status).toBe(400);
    expect((await send(400)).status).toBe(201);
  });

  it("400: unknown Member, card digits without card, float money", async () => {
    const post = (body: object) => request(app()).post(`${T}/expenses`).set(as("act")).send(body);
    expect((await post({ ...base, amount: 100, splitMode: "equal", shares: [{ memberId: "khao-yai:kong" }] })).status).toBe(400);
    expect((await post({ ...base, amount: 100, cardLast4: "1234", splitMode: "equal", shares: [{ memberId: m("act") }] })).status).toBe(400);
    expect((await post({ ...base, amount: 100.5, splitMode: "equal", shares: [{ memberId: m("act") }] })).status).toBe(400);
  });

  it("viewer gets 403", async () => {
    const res = await request(app()).post(`${T}/expenses`).set(as("n")).send({ ...base, amount: 100, splitMode: "equal", shares: [{ memberId: m("n") }] });
    expect(res.status).toBe(403);
  });
});

describe("PATCH / DELETE expenses", () => {
  it("editor edits own Expense; shares are re-split", async () => {
    const res = await request(app()).patch(`${T}/expenses/e-ramen`).set(as("mint")).send({ amount: 160_000 });
    expect(res.status).toBe(200);
    expect(res.body.shares.map((s: { amount: number }) => s.amount)).toEqual([40_000, 40_000, 40_000, 40_000]);
    expect(res.body.updatedBy).toBe(m("mint"));
  });

  it("editor cannot edit or delete someone else's Expense; owner can", async () => {
    expect((await request(app()).patch(`${T}/expenses/e-hotel`).set(as("beam")).send({ title: "x" })).status).toBe(403);
    expect((await request(app()).delete(`${T}/expenses/e-subway`).set(as("mint"))).status).toBe(403);
    expect((await request(app()).patch(`${T}/expenses/e-subway`).set(as("act")).send({ title: "ตั๋ว 72 ชม." })).status).toBe(200);
  });

  it("viewer gets 403", async () => {
    expect((await request(app()).patch(`${T}/expenses/e-hotel`).set(as("n")).send({ title: "x" })).status).toBe(403);
    expect((await request(app()).delete(`${T}/expenses/e-hotel`).set(as("n"))).status).toBe(403);
  });

  it("switching away from card drops the card digits", async () => {
    const res = await request(app()).patch(`${T}/expenses/e-hotel`).set(as("act")).send({ method: "cash" });
    expect(res.body.cardLast4).toBeUndefined();
  });

  it("creator deletes; Transit links are removed; Activity recorded", async () => {
    await collections.planItems().updateOne({ _id: "t-flight-out" }, { $set: { expenseId: "e-subway" } });
    const res = await request(app()).delete(`${T}/expenses/e-subway`).set(as("beam"));
    expect(res.status).toBe(204);
    expect(await collections.planItems().countDocuments({ _id: "t-flight-out", expenseId: { $exists: true } })).toBe(0);
    expect(await collections.activities().countDocuments({ tripId: "tokyo-winter", text: { $regex: "^ลบค่าใช้จ่าย" } })).toBe(1);
  });
});
