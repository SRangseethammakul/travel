import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { K, mid } from "../qa/qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);

beforeEach(async () => {
  await t.reseed();
  await collections.users().updateOne({ _id: "mint" }, { $set: { avatarUrl: "https://pic.example/mint.jpg" } });
});

type M = { id: string; userId: string | null; avatarUrl?: string };

describe("Member avatarUrl", () => {
  it("is computed from the linked User; Unclaimed Members and Users without a picture omit it", async () => {
    const res = await request(app()).get(`/api/trips/${K}/members`).set(as("act"));
    expect(res.status).toBe(200);
    const byId = new Map((res.body as M[]).map((m) => [m.id, m]));
    expect(byId.get(mid(K, "mint"))?.avatarUrl).toBe("https://pic.example/mint.jpg");
    expect(byId.get(mid(K, "kong"))).not.toHaveProperty("avatarUrl");
    expect(byId.get(mid(K, "act"))).not.toHaveProperty("avatarUrl");
  });

  it("is on `me` in GET /trips and GET /trips/:id, and in balances rows", async () => {
    const list = await request(app()).get("/api/trips").set(as("mint"));
    expect(list.body[0].me.avatarUrl).toBe("https://pic.example/mint.jpg");
    const one = await request(app()).get(`/api/trips/${K}`).set(as("mint"));
    expect(one.body.me.avatarUrl).toBe("https://pic.example/mint.jpg");
    const bal = await request(app()).get(`/api/trips/${K}/balances`).set(as("mint"));
    const row = bal.body.rows.find((r: { member: M }) => r.member.id === mid(K, "mint"));
    expect(row.member.avatarUrl).toBe("https://pic.example/mint.jpg");
  });

  it("is not stored in the members collection", async () => {
    expect(await collections.members().countDocuments({ avatarUrl: { $exists: true } } as never)).toBe(0);
  });
});
