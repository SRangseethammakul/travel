import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";

describe("GET activity", () => {
  it("newest first; the receiver sees 'ตรวจและยืนยัน' on Beam's sent transfer", async () => {
    const res = await request(app()).get(`${T}/activity`).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body.map((a: { id: string }) => a.id)).toEqual(["a-1", "a-2", "a-3", "a-4", "a-5", "a-6"]);
    expect(res.body[0]).toMatchObject({ id: "a-1", refId: "s-beam", action: "confirm_settlement" });
    expect(res.body[4].action).toBeUndefined(); // s-mint is already confirmed
  });

  it("no action for anyone but the receiver", async () => {
    const res = await request(app()).get(`${T}/activity`).set(as("beam"));
    expect(res.body[0].action).toBeUndefined();
  });

  it("?type= filters; ?limit= and ?before= (+ beforeId) page", async () => {
    const expense = await request(app()).get(`${T}/activity?type=expense`).set(as("ploy"));
    expect(expense.body.map((a: { id: string }) => a.id)).toEqual(["a-2"]);
    const first = await request(app()).get(`${T}/activity?limit=2`).set(as("ploy"));
    expect(first.body).toHaveLength(2);
    const last = first.body[1];
    // `before` alone is inclusive (never skips same-millisecond items); `beforeId` makes it exact.
    const inclusive = await request(app()).get(`${T}/activity?limit=2&before=${encodeURIComponent(last.createdAt)}`).set(as("ploy"));
    expect(inclusive.body.map((a: { id: string }) => a.id)).toEqual(["a-2", "a-3"]);
    const next = await request(app())
      .get(`${T}/activity?limit=2&before=${encodeURIComponent(last.createdAt)}&beforeId=${last.id}`)
      .set(as("ploy"));
    expect(next.body.map((a: { id: string }) => a.id)).toEqual(["a-3", "a-4"]);
    expect((await request(app()).get(`${T}/activity?type=nope`).set(as("ploy"))).status).toBe(400);
  });

  it("404 for a non-Member", async () => {
    expect((await request(app()).get(`${T}/activity`).set(as("n"))).status).toBe(404);
  });
});

describe("POST activity/read", () => {
  it("adds the User to readBy of the given items, or all of them", async () => {
    expect((await request(app()).post(`${T}/activity/read`).set(as("ploy")).send({ ids: ["a-1"] })).status).toBe(204);
    expect((await collections.activities().findOne({ _id: "a-1" }))?.readBy).toEqual(["ploy"]);
    expect((await request(app()).post(`${T}/activity/read`).set(as("ploy")).send({})).status).toBe(204);
    expect(await collections.activities().countDocuments({ tripId: "tokyo-winter", readBy: { $ne: "ploy" } })).toBe(0);
  });

  it("404 for a non-Member", async () => {
    expect((await request(app()).post(`${T}/activity/read`).set(as("n")).send({})).status).toBe(404);
  });
});
