/** City Legs are edited only through PATCH /api/trips/:tripId (owner). */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const J = "/api/trips/japan-spring";

beforeEach(() => db.reseed());

describe("PATCH trip legs", () => {
  it("owner saves City Legs sorted by day; Activity names the route", async () => {
    const res = await request(app())
      .patch(J)
      .set(as("act"))
      .send({ legs: [{ city: "Osaka", from: 6, to: 9 }, { city: "Tokyo", from: 1, to: 5 }] });
    expect(res.status).toBe(200);
    expect(res.body.legs.map((l: { city: string }) => l.city)).toEqual(["Tokyo", "Osaka"]);
    const activity = await collections.activities().find({ tripId: "japan-spring" }).sort({ createdAt: -1 }).limit(1).next();
    expect(activity?.text).toBe("แก้เส้นทางเมือง: Tokyo → Osaka");
  });

  it("400: overlapping days, a repeated city, or days outside the trip", async () => {
    const send = (legs: object[]) => request(app()).patch(J).set(as("act")).send({ legs });
    expect((await send([{ city: "Tokyo", from: 1, to: 5 }, { city: "Kyoto", from: 5, to: 6 }])).status).toBe(400);
    expect((await send([{ city: "Tokyo", from: 1, to: 2 }, { city: "tokyo", from: 3, to: 4 }])).status).toBe(400);
    expect((await send([{ city: "Tokyo", from: 1, to: 10 }])).status).toBe(400);
  });

  it("an empty list removes the route", async () => {
    const res = await request(app()).patch(J).set(as("act")).send({ legs: [] });
    expect(res.status).toBe(200);
    expect(res.body.legs).toBeUndefined();
  });

  it("editor → 403; the old /legs route is gone", async () => {
    expect((await request(app()).patch(J).set(as("n")).send({ legs: [] })).status).toBe(403);
    expect((await request(app()).put(`${J}/legs`).set(as("act")).send({ legs: [] })).status).toBe(404);
  });
});

describe("viewer", () => {
  it("viewer → 403", async () => {
    await collections.members().updateOne({ _id: "japan-spring:n" }, { $set: { role: "viewer" } });
    expect((await request(app()).patch(J).set(as("n")).send({ legs: [] })).status).toBe(403);
  });
});
