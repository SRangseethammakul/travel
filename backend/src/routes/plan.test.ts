import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";

beforeEach(async () => {
  await db.reseed();
  await collections.members().insertOne({
    _id: "tokyo-winter:n", tripId: "tokyo-winter", userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

describe("GET plan", () => {
  it("sorts by day, time (untimed last), insertion order", async () => {
    const res = await request(app()).get("/api/trips/japan-spring/plan").set(as("n"));
    expect(res.status).toBe(200);
    const ids = res.body.map((i: { id: string }) => i.id);
    // Day 2: j-p4 18:00, j-p5 20:00, then untimed j-p3.
    expect(ids.slice(2, 5)).toEqual(["j-p4", "j-p5", "j-p3"]);
  });

  it("Tokyo starts with the outbound flight (Transit day from departAt)", async () => {
    const res = await request(app()).get(`${T}/plan`).set(as("n"));
    expect(res.body[0].id).toBe("t-flight-out");
    expect(res.body.at(-1).id).toBe("t-flight-back");
  });
});

describe("POST plan/places", () => {
  it("adds one Place to several days at once", async () => {
    const res = await request(app()).post(`${T}/plan/places`).set(as("beam")).send({ placeId: "t-cafe", days: [3, 1], time: "08:30" });
    expect(res.status).toBe(201);
    expect(res.body.map((i: { day: number }) => i.day)).toEqual([1, 3]);
    expect(res.body[0].createdBy).toBe("tokyo-winter:beam");
    const activity = await collections.activities().findOne({ tripId: "tokyo-winter", refId: res.body[0].id });
    expect(activity?.text).toBe('เพิ่ม "คาเฟ่ใต้ทางรถไฟ" ลงแผนวันที่ 3, 1 เวลา 08:30');
  });

  it("viewer gets 403; day outside the trip gets 400", async () => {
    expect((await request(app()).post(`${T}/plan/places`).set(as("n")).send({ placeId: "t-cafe", days: [1] })).status).toBe(403);
    expect((await request(app()).post(`${T}/plan/places`).set(as("act")).send({ placeId: "t-cafe", days: [5] })).status).toBe(400);
  });
});

describe("POST plan/transits", () => {
  const body = { mode: "train", fromText: "Tokyo", toText: "Kyoto", departAt: "2026-12-14T09:00", arriveAt: "2026-12-14T11:15", docIds: ["doc-flight"], expenseId: "e-subway", bookingRef: "SHK1" };

  it("editor adds a Transit linked to a document and an expense", async () => {
    const res = await request(app()).post(`${T}/plan/transits`).set(as("ploy")).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "transit", docIds: ["doc-flight"], expenseId: "e-subway" });
  });

  it("viewer 403; unknown document 400; arrive before depart 400", async () => {
    expect((await request(app()).post(`${T}/plan/transits`).set(as("n")).send(body)).status).toBe(403);
    expect((await request(app()).post(`${T}/plan/transits`).set(as("act")).send({ ...body, docIds: ["nope"] })).status).toBe(400);
    expect((await request(app()).post(`${T}/plan/transits`).set(as("act")).send({ ...body, arriveAt: "2026-12-14T08:00" })).status).toBe(400);
  });
});

describe("PATCH / DELETE plan items and Hops — owner all, editor own only", () => {
  /** A visit added by Mint (editor). */
  const mintsVisit = async () =>
    (await request(app()).post(`${T}/plan/places`).set(as("mint")).send({ placeId: "t-cafe", days: [2] })).body[0].id as string;

  it("owner moves a seeded visit and clears its time", async () => {
    const res = await request(app()).patch(`${T}/plan/t-p2`).set(as("act")).send({ day: 2, time: null });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ day: 2, time: null });
  });

  it("editor edits, sets a Hop on, and deletes own item", async () => {
    const id = await mintsVisit();
    expect((await request(app()).patch(`${T}/plan/${id}`).set(as("mint")).send({ time: "10:00" })).status).toBe(200);
    const hop = await request(app()).put(`${T}/plan/${id}/hop`).set(as("mint")).send({ mode: "walk", minutes: 5 });
    expect(hop.body.travelToNext).toEqual({ mode: "walk", minutes: 5 });
    expect((await request(app()).delete(`${T}/plan/${id}/hop`).set(as("mint"))).status).toBe(200);
    expect((await request(app()).delete(`${T}/plan/${id}`).set(as("mint"))).status).toBe(204);
  });

  it("editor on someone else's item → 403 (edit, Hop, delete)", async () => {
    expect((await request(app()).patch(`${T}/plan/t-p2`).set(as("mint")).send({ day: 2 })).status).toBe(403);
    expect((await request(app()).put(`${T}/plan/t-p2/hop`).set(as("mint")).send({ mode: "walk" })).status).toBe(403);
    expect((await request(app()).delete(`${T}/plan/t-p2/hop`).set(as("mint"))).status).toBe(403);
    expect((await request(app()).delete(`${T}/plan/t-p7`).set(as("beam"))).status).toBe(403);
    const id = await mintsVisit();
    expect((await request(app()).delete(`${T}/plan/${id}`).set(as("beam"))).status).toBe(403);
  });

  it("viewer → 403 (edit, Hop, delete)", async () => {
    expect((await request(app()).patch(`${T}/plan/t-p2`).set(as("n")).send({ day: 2 })).status).toBe(403);
    expect((await request(app()).put(`${T}/plan/t-p2/hop`).set(as("n")).send({ mode: "walk" })).status).toBe(403);
    expect((await request(app()).delete(`${T}/plan/t-p7`).set(as("n"))).status).toBe(403);
  });

  it("owner sets/removes a Hop and deletes anyone's item; transit fields on a visit → 400", async () => {
    const put = await request(app()).put(`${T}/plan/t-p2/hop`).set(as("act")).send({ mode: "taxi", minutes: 12 });
    expect(put.body.travelToNext).toEqual({ mode: "taxi", minutes: 12 });
    expect((await request(app()).delete(`${T}/plan/t-p2/hop`).set(as("act"))).body.travelToNext).toBeUndefined();
    expect((await request(app()).patch(`${T}/plan/t-p2`).set(as("act")).send({ bookingRef: "X" })).status).toBe(400);
    const id = await mintsVisit();
    expect((await request(app()).delete(`${T}/plan/${id}`).set(as("act"))).status).toBe(204);
    expect((await request(app()).delete(`${T}/plan/${id}`).set(as("act"))).status).toBe(404);
  });
});
