import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const db = useTestDb();
const app = () => createApp(testConfig);
const T = "/api/trips/tokyo-winter";
const m = (k: string) => `tokyo-winter:${k}`;

beforeEach(() => db.reseed());

describe("GET settlements / balances / summary", () => {
  it("any Member reads them; non-Member 404", async () => {
    expect((await request(app()).get(`${T}/settlements`).set(as("ploy"))).body.map((s: { id: string }) => s.id)).toEqual(["s-mint", "s-beam"]);
    expect((await request(app()).get(`${T}/summary`).set(as("n"))).status).toBe(404);
  });

  it("balances: Suggested Transfers carry the open Settlement", async () => {
    const res = await request(app()).get(`${T}/balances`).set(as("ploy"));
    expect(res.body.transfers.map((t: { from: { id: string }; amount: number; settlement: { id: string } | null }) => [t.from.id, t.amount, t.settlement?.id ?? null])).toEqual([
      [m("beam"), 580_000, "s-beam"],
      [m("ploy"), 515_000, null],
    ]);
  });

  it("summary: spending per category and where each number comes from", async () => {
    const res = await request(app()).get(`${T}/summary`).set(as("act"));
    expect(res.body.byCategory).toEqual([
      { category: "stay", amount: 2_200_000 },
      { category: "transport", amount: 105_000 },
      { category: "food", amount: 450_000 },
      { category: "activity", amount: 280_000 },
    ]);
    const beam = res.body.rows.find((r: { member: { id: string } }) => r.member.id === m("beam"));
    expect(beam.items.map((i: { expenseId: string }) => i.expenseId)).toEqual(["e-hotel", "e-subway", "e-ramen", "e-skytree"]);
  });
});

describe("balances / summary per role — a viewer sees only their own numbers (SPEC สิทธิ์)", () => {
  type Body = { total: number; rows: { member: { id: string } }[]; transfers: { from: { id: string }; to: { id: string } }[]; byCategory?: unknown[] };
  const read = async (path: string, user: string) => {
    const res = await request(app()).get(`${T}/${path}`).set(as(user));
    expect(res.status).toBe(200);
    return res.body as Body;
  };
  const ids = (b: Body) => ({ rows: b.rows.map((r) => r.member.id), transfers: b.transfers.map((t) => [t.from.id, t.to.id]) });
  const all = {
    rows: [m("act"), m("beam"), m("mint"), m("ploy")],
    transfers: [[m("beam"), m("act")], [m("ploy"), m("act")]],
  };

  for (const path of ["balances", "summary"]) {
    it(`${path}: owner sees every Member`, async () => {
      expect(ids(await read(path, "act"))).toEqual(all);
    });

    it(`${path}: editor sees every Member`, async () => {
      await collections.members().updateOne({ _id: m("ploy") }, { $set: { role: "editor" } });
      expect(ids(await read(path, "ploy"))).toEqual(all);
    });

    it(`${path}: viewer sees only their own row and their own transfers; trip total stays`, async () => {
      await collections.members().updateOne({ _id: m("ploy") }, { $set: { role: "viewer" } });
      const body = await read(path, "ploy");
      expect(ids(body)).toEqual({ rows: [m("ploy")], transfers: [[m("ploy"), m("act")]] });
      expect(body.total).toBe(3_035_000);
    });

    it(`${path}: a viewer who is owed money sees the transfers to them`, async () => {
      await collections.members().updateOne({ _id: m("act") }, { $set: { role: "viewer" } });
      await collections.members().updateOne({ _id: m("mint") }, { $set: { role: "owner" } });
      expect(ids(await read(path, "act"))).toEqual({ rows: [m("act")], transfers: all.transfers });
    });

    it(`${path}: a viewer with no transfers gets only their row`, async () => {
      await collections.members().updateOne({ _id: m("mint") }, { $set: { role: "viewer" } });
      expect(ids(await read(path, "mint"))).toEqual({ rows: [m("mint")], transfers: [] });
    });
  }

  it("summary: a viewer's byCategory is the whole trip, items only their own", async () => {
    await collections.members().updateOne({ _id: m("beam") }, { $set: { role: "viewer" } });
    const res = await request(app()).get(`${T}/summary`).set(as("beam"));
    expect(res.body.byCategory).toHaveLength(4);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].items.map((i: { expenseId: string }) => i.expenseId)).toEqual(["e-hotel", "e-subway", "e-ramen", "e-skytree"]);
  });
});

describe("POST settlements — sender reports (Ploy's side)", () => {
  it("defaults to the Suggested Transfer and is stored as sent", async () => {
    const res = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act"), slipDocId: "doc-flight" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromId: m("ploy"), toId: m("act"), amount: 515_000, status: "sent", slipDocId: "doc-flight", sentAt: expect.any(String) });
    const activity = await collections.activities().findOne({ refId: res.body.id });
    expect(activity?.text).toBe("แจ้งโอนเงินให้ Act ฿5,150 พร้อมแนบสลิป");
  });

  it("a second open report to the same receiver → 409", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("beam")).send({ toId: m("act") })).status).toBe(409);
  });

  it("more than owed → 400; nothing owed → 409; to myself → 400", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act"), amount: 600_000 })).status).toBe(400);
    expect((await request(app()).post(`${T}/settlements`).set(as("mint")).send({ toId: m("act") })).status).toBe(409);
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("ploy") })).status).toBe(400);
  });

  it("a viewer may report their own transfer", async () => {
    await collections.members().updateOne({ _id: m("ploy") }, { $set: { role: "viewer" } });
    const res = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act"), amount: 100_000 });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(100_000);
  });
});

/** Mint pays ฿1,000 for Ploy: Mint is owed ฿1,000, Ploy now owes ฿6,150 (Act ฿6,150 + Mint ฿1,000 suggested to Beam). */
async function makeMintACreditor() {
  const res = await request(app())
    .post(`${T}/expenses`)
    .set(as("act"))
    .send({ title: "ค่าน้ำ", category: "food", payerId: m("mint"), method: "cash", date: "2026-12-14", amount: 100_000, splitMode: "amount", shares: [{ memberId: m("ploy"), amount: 100_000 }] });
  expect(res.status).toBe(201);
}

describe("POST settlements — total reported may not exceed what I owe (BUG-B6)", () => {
  const sentFromPloy = async () =>
    (await collections.settlements().find({ fromId: m("ploy"), status: "sent" }).toArray()).reduce((sum, s) => sum + s.amount, 0);
  beforeEach(makeMintACreditor);

  it("partial reports to different receivers add up to the limit, one satang more → 400", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act"), amount: 600_000 })).status).toBe(201);
    const over = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 15_001 });
    expect(over.status).toBe(400);
    expect(over.body.error).toEqual({ code: "amount_too_large", message: "ยอดโอนเกินยอดค้างที่ยังไม่ได้แจ้งโอน (฿150)" });
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 15_000 })).status).toBe(201);
    expect(await sentFromPloy()).toBe(615_000);
  });

  it("without `amount`, the Suggested Transfer is lowered to what is not reported yet", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 100 })).status).toBe(201);
    const res = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act") });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(614_900);
    expect(await sentFromPloy()).toBe(615_000);
  });

  it("everything already reported → 400 even without `amount`", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 615_000 })).status).toBe(201);
    const res = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act") });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("amount_too_large");
  });

  it("after the receiver confirms, the limit follows the new Outstanding", async () => {
    expect((await request(app()).post(`${T}/settlements`).set(as("beam")).send({ toId: m("mint"), amount: 100 })).status).toBe(400);
    expect((await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"))).status).toBe(200);
    expect((await request(app()).post(`${T}/settlements`).set(as("beam")).send({ toId: m("mint"), amount: 100 })).status).toBe(409);
  });

  it("parallel reports to different receivers never leave more than owed as sent", async () => {
    for (let round = 0; round < 5; round++) {
      await db.reseed();
      await makeMintACreditor();
      const results = await Promise.all([
        request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("act"), amount: 615_000 }),
        request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 10_000 }),
      ]);
      for (const r of results) expect([201, 400]).toContain(r.status);
      expect(await sentFromPloy()).toBeLessThanOrEqual(615_000);
      const created = results.filter((r) => r.status === 201).map((r) => r.body.id as string);
      // Every 201 is still stored, and has its Activity; a backed-out report left none.
      expect(await collections.settlements().countDocuments({ _id: { $in: created } })).toBe(created.length);
      expect(await collections.activities().countDocuments({ type: "settlement", actorId: m("ploy") })).toBe(created.length);
    }
  });
});

describe("POST settlements — who can receive", () => {
  it("a receiver who is owed nothing → 400", async () => {
    const res = await request(app()).post(`${T}/settlements`).set(as("ploy")).send({ toId: m("mint"), amount: 10_000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "receiver_not_owed", message: "Mint ไม่มียอดที่ต้องได้คืน" });
  });

  it("an Unclaimed Member who is owed money may receive → 201 (they confirm after a Claim)", async () => {
    const K = "/api/trips/khao-yai";
    const e = await request(app()).post(`${K}/expenses`).set(as("act")).send({
      ...{ title: "ค่าที่พัก", category: "stay", method: "cash", date: "2026-06-13" },
      payerId: "khao-yai:kong", amount: 800_000, splitMode: "amount", shares: [{ memberId: "khao-yai:act", amount: 800_000 }],
    });
    expect(e.status).toBe(201);
    const res = await request(app()).post(`${K}/settlements`).set(as("act")).send({ toId: "khao-yai:kong", amount: 10_000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromId: "khao-yai:act", toId: "khao-yai:kong", status: "sent" });
  });
});

describe("GET settlements per role", () => {
  it("every role sees every transfer of the trip, viewers included", async () => {
    const ids = async (user: string) => (await request(app()).get(`${T}/settlements`).set(as(user))).body.map((s: { id: string }) => s.id);
    expect(await ids("act")).toEqual(["s-mint", "s-beam"]);
    expect(await ids("ploy")).toEqual(["s-mint", "s-beam"]);
    await collections.members().updateOne({ _id: m("ploy") }, { $set: { role: "viewer" } });
    expect(await ids("ploy")).toEqual(["s-mint", "s-beam"]);
  });
});

describe("confirm — receiver only (Act's side)", () => {
  it("Act confirms Beam's sent transfer", async () => {
    const res = await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "confirmed", confirmedAt: expect.any(String) });
  });

  it("the sender or anyone else → 403", async () => {
    expect((await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("beam"))).status).toBe(403);
    expect((await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("ploy"))).status).toBe(403);
  });

  it("already confirmed (or confirmed twice) → 409; unknown → 404", async () => {
    expect((await request(app()).post(`${T}/settlements/s-mint/confirm`).set(as("act"))).status).toBe(409);
    expect((await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"))).status).toBe(200);
    expect((await request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"))).status).toBe(409);
    expect((await request(app()).post(`${T}/settlements/nope/confirm`).set(as("act"))).status).toBe(404);
  });

  it("two confirms at once: exactly one wins", async () => {
    const results = await Promise.all([1, 2].map(() => request(app()).post(`${T}/settlements/s-beam/confirm`).set(as("act"))));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe("slip — sender only, while sent", () => {
  it("Beam replaces the slip; Act gets 403; after confirm → 409", async () => {
    const ok = await request(app()).post(`${T}/settlements/s-beam/slip`).set(as("beam")).send({ slipDocId: "doc-hotel" });
    expect(ok.status).toBe(200);
    expect(ok.body.slipDocId).toBe("doc-hotel");
    expect((await request(app()).post(`${T}/settlements/s-beam/slip`).set(as("act")).send({ slipDocId: "doc-hotel" })).status).toBe(403);
    expect((await request(app()).post(`${T}/settlements/s-mint/slip`).set(as("mint")).send({ slipDocId: "doc-hotel" })).status).toBe(409);
  });
});
