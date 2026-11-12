/** End to end (first-backend.md ช่วง 4): seed Tokyo → summary numbers → Beam confirmed → Outstanding changes. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";

type Row = { member: { displayName: string }; net: number; outstanding: number };
const byName = (rows: Row[], key: "net" | "outstanding") => Object.fromEntries(rows.map((r) => [r.member.displayName, r[key]]));

describe("Tokyo money, end to end", () => {
  it("summary matches the SPEC numbers, then Beam's confirmed transfer changes Outstanding only", async () => {
    const before = await request(app()).get(`${T}/summary`).set(as("act"));
    expect(before.status).toBe(200);
    expect(before.body.total).toBe(3_035_000);
    expect(byName(before.body.rows, "net")).toEqual({ Act: 1_405_000, Mint: -310_000, Beam: -580_000, Ploy: -515_000 });
    expect(byName(before.body.rows, "outstanding")).toEqual({ Act: 1_095_000, Mint: 0, Beam: -580_000, Ploy: -515_000 });

    const confirm = await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"));
    expect(confirm.status).toBe(200);

    const after = await request(app()).get(`${T}/summary`).set(as("ploy"));
    // Net Balance comes from Expenses only, so it does not move.
    expect(byName(after.body.rows, "net")).toEqual({ Act: 1_405_000, Mint: -310_000, Beam: -580_000, Ploy: -515_000 });
    expect(byName(after.body.rows, "outstanding")).toEqual({ Act: 515_000, Mint: 0, Beam: 0, Ploy: -515_000 });
    expect(after.body.transfers.map((t: { from: { displayName: string }; to: { displayName: string }; amount: number }) => [t.from.displayName, t.to.displayName, t.amount])).toEqual([
      ["Ploy", "Act", 515_000],
    ]);
  });
});
