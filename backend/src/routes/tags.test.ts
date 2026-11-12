import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);

beforeEach(() => db.reseed());

describe("trip tags", () => {
  it("GET /trips/:id/tags lists tags used in the trip", async () => {
    const res = await request(app()).get("/api/trips/japan-spring/tags").set(as("n"));
    expect(res.status).toBe(200);
    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).toContain("tag-soba");
    expect(ids).toContain("tag-ramen");
    expect(ids).not.toContain("tag-temple"); // Act's tag, not used in Japan
  });

  it("suggest: mine first, then other tags in the trip", async () => {
    const res = await request(app()).get("/api/trips/japan-spring/tags/suggest?q=รา").set(as("n"));
    expect(res.status).toBe(200);
    expect(res.body.mine).toEqual([]);
    expect(res.body.others.map((t: { id: string }) => t.id)).toEqual(["tag-ramen"]);
    const n = await request(app()).get("/api/trips/japan-spring/tags/suggest").set(as("n"));
    expect(n.body.mine.map((t: { id: string }) => t.id).sort()).toEqual(["tag-soba", "tag-street"]);
  });

  it("404 for a non-Member", async () => {
    expect((await request(app()).get("/api/trips/japan-spring/tags").set(as("mint"))).status).toBe(404);
  });
});

describe("my tags", () => {
  it("401 when signed out", async () => {
    expect((await request(app()).get("/api/me/tags")).status).toBe(401);
  });

  it("lists only my tags and their usage", async () => {
    const res = await request(app()).get("/api/me/tags").set(as("n"));
    expect(res.body.map((t: { id: string }) => t.id).sort()).toEqual(["tag-soba", "tag-street"]);
    const usage = await request(app()).get("/api/me/tags/usage").set(as("act"));
    expect(usage.body["tag-ramen"]).toBe(4); // t-ramen, j-ramen, j-station-ramen, j-umeda-ramen
  });

  it("creates, renames, regroups; duplicate name → 409", async () => {
    const created = await request(app()).post("/api/me/tags").set(as("mint")).send({ name: "#ซูชิ" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ownerId: "mint", name: "ซูชิ", group: null });
    const patched = await request(app()).patch(`/api/me/tags/${created.body.id}`).set(as("mint")).send({ group: "อาหาร" });
    expect(patched.body.group).toBe("อาหาร");
    expect((await request(app()).post("/api/me/tags").set(as("mint")).send({ name: "ซูชิ" })).status).toBe(409);
  });

  it("someone else's tag → 403", async () => {
    expect((await request(app()).patch("/api/me/tags/tag-ramen").set(as("n")).send({ name: "x" })).status).toBe(403);
    expect((await request(app()).delete("/api/me/tags/tag-ramen").set(as("n"))).status).toBe(403);
  });

  it("delete takes the tag off every Place and returns the count", async () => {
    const res = await request(app()).delete("/api/me/tags/tag-booking").set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removedFromPlaces: 4 }); // t-yakiniku, t-tempura, j-yakiniku, j-wagyu
    expect(await collections.places().countDocuments({ tagIds: "tag-booking" })).toBe(0);
    expect(await collections.tags().findOne({ _id: "tag-booking" })).toBeNull();
  });
});
