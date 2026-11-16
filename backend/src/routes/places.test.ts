import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";

/** N joins Tokyo as a viewer (the seed has no viewer). */
beforeEach(async () => {
  await db.reseed();
  await collections.members().insertOne({
    _id: "tokyo-winter:n", tripId: "tokyo-winter", userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

const lastActivity = () => collections.activities().find({ tripId: "tokyo-winter" }).sort({ createdAt: -1 }).limit(1).next();

describe("GET places", () => {
  it("lists the 12 Tokyo places for any Member", async () => {
    const res = await request(app()).get(`${T}/places`).set(as("n"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toMatchObject({ id: expect.any(String), tripId: "tokyo-winter" });
    expect(res.body[0]._id).toBeUndefined();
  });

  it("404 for a non-Member", async () => {
    expect((await request(app()).get("/api/trips/khao-yai/places").set(as("ploy"))).status).toBe(404);
  });

  it("filters by area, tags (any of) and unscheduled", async () => {
    const area = await request(app()).get(`${T}/places?city=Tokyo&area=Asakusa`).set(as("act"));
    expect(area.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-sensoji", "t-skytree", "t-tempura"]);

    const tags = await request(app()).get(`${T}/places?tags=tag-booking,tag-view`).set(as("act"));
    expect(tags.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-skytree", "t-tempura", "t-yakiniku"]);

    const unscheduled = await request(app()).get(`${T}/places?unscheduled=1`).set(as("act"));
    expect(unscheduled.body.map((p: { id: string }) => p.id).sort()).toEqual(["t-cafe", "t-omoide", "t-tempura"]);
  });

  it("groups by area with the scheduled count", async () => {
    const res = await request(app()).get(`${T}/places?group=area`).set(as("act"));
    const shinjuku = res.body.find((g: { key: string }) => g.key === "Shinjuku");
    expect(shinjuku).toMatchObject({ count: 4, scheduled: 3 });
    expect(res.body).toHaveLength(6); // 5 areas + "ไม่ระบุย่าน" (Haneda)
  });
});

describe("POST places", () => {
  it("editor adds a Place with an existing tag and a new tag; Activity recorded", async () => {
    const res = await request(app())
      .post(`${T}/places`)
      .set(as("mint"))
      .send({ name: "  ร้านซูชิ ", type: "food", city: "Tokyo", area: "Tsukiji", tagIds: ["tag-booking"], newTags: ["#ซูชิ", "ราเมง"], mapUrl: "https://maps.app.goo.gl/x" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "ร้านซูชิ", area: "Tsukiji", createdBy: "tokyo-winter:mint", mapUrl: "https://maps.app.goo.gl/x" });
    // "ราเมง" reuses Act's tag used in this trip; "ซูชิ" is created for Mint.
    expect(res.body.tagIds).toContain("tag-booking");
    expect(res.body.tagIds).toContain("tag-ramen");
    const created = await collections.tags().findOne({ ownerId: "mint", name: "ซูชิ" });
    expect(created).not.toBeNull();
    expect((await lastActivity())?.text).toContain("ร้านซูชิ");
  });

  it("viewer gets 403", async () => {
    const res = await request(app()).post(`${T}/places`).set(as("n")).send({ name: "x", type: "food", city: "Tokyo" });
    expect(res.status).toBe(403);
  });

  it("400 for a tag the User cannot use in this trip", async () => {
    const res = await request(app()).post(`${T}/places`).set(as("act")).send({ name: "x", type: "food", city: "Tokyo", tagIds: ["tag-soba"] });
    expect(res.status).toBe(400);
  });
});

describe("PATCH / DELETE places — owner all, editor own only", () => {
  it("owner edits anyone's Place; editor edits own", async () => {
    expect((await request(app()).patch(`${T}/places/t-cafe`).set(as("act")).send({ note: "เปิด 8 โมง" })).status).toBe(200);
    const own = await request(app()).patch(`${T}/places/t-cafe`).set(as("mint")).send({ note: "เปิด 9 โมง", mapUrl: null });
    expect(own.status).toBe(200);
    expect(own.body.note).toBe("เปิด 9 โมง");
  });

  it("editor editing someone else's Place → 403; viewer → 403", async () => {
    expect((await request(app()).patch(`${T}/places/t-cafe`).set(as("beam")).send({ note: "x" })).status).toBe(403);
    expect((await request(app()).patch(`${T}/places/t-cafe`).set(as("n")).send({ note: "x" })).status).toBe(403);
  });

  it("editor deletes own Place and its visits; someone else's → 403; viewer → 403", async () => {
    expect((await request(app()).delete(`${T}/places/t-ramen`).set(as("beam"))).status).toBe(403);
    expect((await request(app()).delete(`${T}/places/t-ramen`).set(as("n"))).status).toBe(403);
    expect((await request(app()).delete(`${T}/places/t-ramen`).set(as("mint"))).status).toBe(204);
    expect(await collections.planItems().countDocuments({ placeId: "t-ramen" })).toBe(0);
  });

  it("owner deletes anyone's Place", async () => {
    expect((await request(app()).delete(`${T}/places/t-omoide`).set(as("act"))).status).toBe(204);
  });

  it("409 when a Transit starts or ends at the Place", async () => {
    expect((await request(app()).delete(`${T}/places/t-haneda`).set(as("act"))).status).toBe(409);
  });
});

describe("Place stay (hotel details)", () => {
  const stay = { checkIn: "2026-12-12", checkOut: "2026-12-15", price: 450000, bookingRef: "AB123", address: "1-1 Shinjuku" };
  const hotel = { name: "โรงแรม", type: "stay", city: "Tokyo", stay };

  it("editor creates a stay Place; returned, then removed with stay:null", async () => {
    const res = await request(app()).post(`${T}/places`).set(as("mint")).send(hotel);
    expect(res.status).toBe(201);
    expect(res.body.stay).toEqual(stay);
    const got = await request(app()).get(`${T}/places/${res.body.id}`).set(as("n"));
    expect(got.body.stay).toEqual(stay);
    const patched = await request(app()).patch(`${T}/places/${res.body.id}`).set(as("mint")).send({ stay: { checkIn: "2026-12-13", checkOut: "2026-12-14" } });
    expect(patched.body.stay).toEqual({ checkIn: "2026-12-13", checkOut: "2026-12-14" });
    const removed = await request(app()).patch(`${T}/places/${res.body.id}`).set(as("mint")).send({ stay: null });
    expect(removed.status).toBe(200);
    expect(removed.body.stay).toBeUndefined();
  });

  it("400 for non-stay type, bad order, out of trip dates, float price", async () => {
    const post = (b: object) => request(app()).post(`${T}/places`).set(as("mint")).send(b);
    expect((await post({ ...hotel, type: "food" })).status).toBe(400);
    expect((await post({ ...hotel, stay: { ...stay, checkOut: "2026-12-12" } })).status).toBe(400);
    expect((await post({ ...hotel, stay: { ...stay, checkOut: "2026-12-20" } })).status).toBe(400);
    expect((await post({ ...hotel, stay: { ...stay, price: 10.5 } })).status).toBe(400);
    expect((await request(app()).patch(`${T}/places/t-cafe`).set(as("act")).send({ stay })).status).toBe(400);
  });

  it("viewer cannot add one → 403", async () => {
    expect((await request(app()).post(`${T}/places`).set(as("n")).send(hotel)).status).toBe(403);
  });
});

describe("PATCH areas — owner only", () => {
  it("renames an Area within a city and returns the count", async () => {
    const res = await request(app()).patch(`${T}/areas`).set(as("act")).send({ city: "Tokyo", from: "Akihabara", to: "Akiba" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedPlaces: 2 });
    expect(await collections.places().countDocuments({ tripId: "tokyo-winter", area: "Akiba" })).toBe(2);
  });

  it("editor → 403; viewer → 403", async () => {
    const body = { city: "Tokyo", from: "Shibuya", to: "Shinjuku" };
    expect((await request(app()).patch(`${T}/areas`).set(as("ploy")).send(body)).status).toBe(403);
    expect((await request(app()).patch(`${T}/areas`).set(as("n")).send(body)).status).toBe(403);
  });

  it("merges into an existing Area; unknown Area → 404", async () => {
    const res = await request(app()).patch(`${T}/areas`).set(as("act")).send({ city: "Tokyo", from: "Shibuya", to: "Shinjuku" });
    expect(res.body).toEqual({ updatedPlaces: 1 });
    expect((await request(app()).patch(`${T}/areas`).set(as("act")).send({ city: "Tokyo", from: "Nowhere", to: "x" })).status).toBe(404);
  });
});

describe("Place stay → linked Expense", () => {
  const stay = { checkIn: "2026-12-12", checkOut: "2026-12-15", expenseId: "e-hotel" };
  const hotel = { name: "โรงแรม", type: "stay", city: "Tokyo", stay };

  it("accepts expenseId, returns it, PATCH without it unlinks", async () => {
    const res = await request(app()).post(`${T}/places`).set(as("mint")).send(hotel);
    expect(res.status).toBe(201);
    expect(res.body.stay.expenseId).toBe("e-hotel");
    const patched = await request(app()).patch(`${T}/places/${res.body.id}`).set(as("mint")).send({ stay: { checkIn: "2026-12-12", checkOut: "2026-12-15" } });
    expect(patched.body.stay.expenseId).toBeUndefined();
  });

  it("400 for unknown expense, 403 for viewer", async () => {
    const bad = await request(app()).post(`${T}/places`).set(as("mint")).send({ ...hotel, stay: { ...stay, expenseId: "nope" } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe("ไม่พบค่าใช้จ่ายที่เลือกในทริปนี้");
    expect((await request(app()).post(`${T}/places`).set(as("n")).send(hotel)).status).toBe(403);
  });

  it("deleting the Expense unsets the link", async () => {
    const res = await request(app()).post(`${T}/places`).set(as("act")).send(hotel);
    expect((await request(app()).delete(`${T}/expenses/e-hotel`).set(as("act"))).status).toBe(204);
    const got = await request(app()).get(`${T}/places/${res.body.id}`).set(as("act"));
    expect(got.body.stay.expenseId).toBeUndefined();
  });
});
