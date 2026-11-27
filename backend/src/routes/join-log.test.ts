import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const t = useTestDb();
const config = { ...testConfig, ADMIN_USER_IDS: ["act"] };
const app = () => createApp(config, { recordRequests: true });
const TOKEN = "tokyo-winter-7d-seed-invite";

beforeEach(() => t.reseed());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function logsWhen(count: number) {
  for (let i = 0; i < 80; i++) {
    const rows = await collections.requestLogs().find().toArray();
    if (rows.filter((r) => r.path.startsWith("/api/join/")).length >= count) return rows;
    await sleep(25);
  }
  return collections.requestLogs().find().toArray();
}

describe("invite token in request logs", () => {
  it.each(["get", "post"] as const)("%s /api/join/<token> is stored and served as /api/join/:token", async (method) => {
    await request(app())[method](`/api/join/${TOKEN}`).set(as("ploy"));
    const rows = await logsWhen(1);
    expect(rows.some((r) => r.path === "/api/join/:token")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(TOKEN);

    const res = await request(app()).get("/api/admin/system").set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body.logs.items.some((l: { path: string }) => l.path === "/api/join/:token")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });
});
