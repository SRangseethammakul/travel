/**
 * QA: Settlements (API.md A13, B32–B34). Status only moves pending → sent (payer) → confirmed
 * (receiver); pending is computed from Suggested Transfers and never stored.
 * Sources: SPEC "ค่าใช้จ่ายและการหาร", first-backend.md "เงิน" / "สิทธิ์", CONTEXT.md Settlement.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { activityCount, expectError, expectIdNotUnderscore, expectTimestamp, K, mid, setMember, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const base = `/api/trips/${T}/settlements`;
const M = (k: string) => mid(T, k);
const report = (user: string, body: object) => request(app()).post(base).set(as(user)).send(body);
const confirm = (user: string, id: string) => request(app()).post(`${base}/${id}/confirm`).set(as(user));

type Row = { member: { id: string }; net: number; outstanding: number };
async function outstanding() {
  const res = await request(app()).get(`/api/trips/${T}/balances`).set(as("act"));
  return Object.fromEntries((res.body.rows as Row[]).map((r) => [r.member.id, r.outstanding]));
}

beforeEach(() => t.reseed());

describe("reads", () => {
  it("GET settlements: Settlement[] with id, ISO timestamps, status", async () => {
    const res = await request(app()).get(base).set(as("ploy"));
    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id).sort()).toEqual(["s-beam", "s-mint"]);
    for (const s of res.body) {
      expectIdNotUnderscore(s);
      expectTimestamp(s.createdAt);
      expect(["pending", "sent", "confirmed"]).toContain(s.status);
    }
    const mint = res.body.find((s: { id: string }) => s.id === "s-mint");
    expectTimestamp(mint.confirmedAt);
  });
});

describe("report (B32) — sent by the payer", () => {
  it("Ploy reports her Suggested Transfer to Act → 201 status 'sent', fromId = Ploy, amount = ฿5,150", async () => {
    const res = await report("ploy", { toId: M("act") });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromId: M("ploy"), toId: M("act"), amount: 515_000, status: "sent", tripId: T });
    expectTimestamp(res.body.sentAt);
    expect(res.body.confirmedAt).toBeUndefined();
  });

  it("a sent Settlement does not change Outstanding yet (CONTEXT: only confirmed counts)", async () => {
    await report("ploy", { toId: M("act") });
    expect((await outstanding())[M("ploy")]).toBe(-515_000);
  });

  it("the body cannot choose the payer: `fromId` is rejected (Current Member only)", async () => {
    // Act tries to report a transfer "from Ploy".
    expectError(await report("act", { toId: M("act"), fromId: M("ploy") }), 400);
    expect((await collections.settlements().countDocuments({ tripId: T, fromId: M("ploy") }))).toBe(0);
  });

  it("the body cannot set the status (`status: 'confirmed'`) → 400", async () => {
    expectError(await report("ploy", { toId: M("act"), status: "confirmed" }), 400);
  });

  it("transfer to yourself → 400", async () => {
    expectError(await report("ploy", { toId: M("ploy") }), 400);
  });

  it("receiver from another trip → 400/404", async () => {
    expectError(await report("ploy", { toId: mid(K, "mint") }), [400, 404]);
  });

  it("amount not integer satang / zero / negative / over the cap → 400", async () => {
    for (const amount of [100.5, 0, -1, 2_000_000_001, "1000"]) {
      expectError(await report("ploy", { toId: M("act"), amount }), 400);
    }
  });

  it("amount above what I still owe → 400", async () => {
    expectError(await report("ploy", { toId: M("act"), amount: 515_001 }), 400);
  });

  it("someone who owes nothing (Mint, Outstanding 0) cannot report → 409", async () => {
    expectError(await report("mint", { toId: M("act") }), 409);
  });

  it("a second open (sent) Settlement to the same receiver → 409", async () => {
    // Beam already has s-beam sent to Act.
    expectError(await report("beam", { toId: M("act") }), 409);
  });

  it("concurrent reports of the same transfer → exactly one 201, the rest 409", async () => { // BUG-2
    // The race window is small, so try 10 rounds of 5 parallel clicks; every round must give one 201.
    for (let round = 0; round < 10; round++) {
      await collections.settlements().deleteMany({ tripId: T, fromId: M("ploy") });
      const all = await Promise.all(Array.from({ length: 5 }, () => report("ploy", { toId: M("act") })));
      expect(all.map((r) => r.status).sort(), `round ${round}`).toEqual([201, 409, 409, 409, 409]);
      expect(await collections.settlements().countDocuments({ tripId: T, fromId: M("ploy"), status: "sent" })).toBe(1);
    }
  });

  it("viewer may report a transfer where they are the payer (SPEC: ดูอย่างเดียว แจ้งโอนเงินได้)", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const res = await report("ploy", { toId: M("act"), amount: 100_000 });
    expect(res.status).toBe(201);
    expect(res.body.fromId).toBe(M("ploy"));
  });

  it("partial transfer: Ploy reports ฿1,000 of ฿5,150 → 201", async () => {
    const res = await report("ploy", { toId: M("act"), amount: 100_000 });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(100_000);
  });

  it("adds a 'settlement' Activity", async () => {
    const n0 = await activityCount(T);
    await report("ploy", { toId: M("act") });
    expect(await activityCount(T)).toBe(n0 + 1);
    const feed = await request(app()).get(`/api/trips/${T}/activity?type=settlement`).set(as("act"));
    expect(feed.body[0]).toMatchObject({ type: "settlement", actorId: M("ploy") });
  });
});

describe("confirm (B33) — receiver only, sent → confirmed", () => {
  it("Act confirms Beam's sent ฿5,800 → 200 confirmed with confirmedAt; Outstanding Beam 0, Act +฿5,150", async () => {
    const res = await confirm("act", "s-beam");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expectTimestamp(res.body.confirmedAt);
    const o = await outstanding();
    expect(o[M("beam")]).toBe(0);
    expect(o[M("act")]).toBe(1_095_000 - 580_000);
    expect(o[M("ploy")]).toBe(-515_000);
    expect(o[M("mint")]).toBe(0);
  });

  it("Net Balance is not affected by confirming (CONTEXT: Net Balance)", async () => {
    await confirm("act", "s-beam");
    const res = await request(app()).get(`/api/trips/${T}/balances`).set(as("act"));
    const beam = res.body.rows.find((r: Row) => r.member.id === M("beam"));
    expect(beam.net).toBe(-580_000);
  });

  it("after confirming, the Suggested Transfer Beam → Act disappears", async () => {
    await confirm("act", "s-beam");
    const res = await request(app()).get(`/api/trips/${T}/balances`).set(as("act"));
    expect(res.body.transfers.map((x: { from: { id: string } }) => x.from.id)).toEqual([M("ploy")]);
  });

  it("the payer cannot confirm their own Settlement → 403", async () => {
    expectError(await confirm("beam", "s-beam"), 403);
  });

  it("a third Member cannot confirm → 403", async () => {
    expectError(await confirm("ploy", "s-beam"), 403);
  });

  it("confirming twice → second is 409", async () => {
    expect((await confirm("act", "s-beam")).status).toBe(200);
    expectError(await confirm("act", "s-beam"), 409);
  });

  it("confirming an already confirmed Settlement (s-mint) → 409", async () => {
    expectError(await confirm("act", "s-mint"), 409);
  });

  it("two concurrent confirms → exactly one 200, the other 409, one Activity", async () => {
    const n0 = await activityCount(T);
    const [a, b] = await Promise.all([confirm("act", "s-beam"), confirm("act", "s-beam")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await activityCount(T)).toBe(n0 + 1);
  });

  it("unknown Settlement / Settlement from another trip → 404", async () => {
    expectError(await confirm("act", "nope"), 404);
    expectError(await confirm("act", "s-k-act"), 404);
  });
});

describe("slip (B34) — sender only, while sent", () => {
  it("Beam replaces the slip on his sent Settlement with a document of this trip → 200", async () => {
    const res = await request(app()).post(`${base}/s-beam/slip`).set(as("beam")).send({ slipDocId: "doc-insurance" });
    expect(res.status).toBe(200);
    expect(res.body.slipDocId).toBe("doc-insurance");
  });

  it("receiver cannot replace the slip → 403", async () => {
    expectError(await request(app()).post(`${base}/s-beam/slip`).set(as("act")).send({ slipDocId: "doc-insurance" }), 403);
  });

  it("after confirmed → 409 (no going back)", async () => {
    await confirm("act", "s-beam");
    expectError(await request(app()).post(`${base}/s-beam/slip`).set(as("beam")).send({ slipDocId: "doc-insurance" }), 409);
  });

  it("unknown slip document → 400", async () => {
    expectError(await request(app()).post(`${base}/s-beam/slip`).set(as("beam")).send({ slipDocId: "nope" }), 400);
  });
});

describe("no backwards or skipped transitions", () => {
  it("there is no endpoint that moves a Settlement back to sent/pending", async () => {
    for (const path of [`${base}/s-mint`, `${base}/s-mint/unconfirm`, `${base}/s-mint/pending`]) {
      const patch = await request(app()).patch(path).set(as("act")).send({ status: "sent" });
      expect([404, 405]).toContain(patch.status);
    }
    const s = await collections.settlements().findOne({ _id: "s-mint" });
    expect(s?.status).toBe("confirmed");
  });

  it("end-to-end: Ploy reports, Act confirms → everyone's Outstanding is 0", async () => {
    await confirm("act", "s-beam");
    const sent = await report("ploy", { toId: M("act") });
    expect(sent.status).toBe(201);
    expect((await confirm("act", sent.body.id)).status).toBe(200);
    expect(Object.values(await outstanding()).every((v) => v === 0)).toBe(true);
  });
});

describe("balances ↔ open Settlement link", () => {
  // API.md A14: transfers[] "each with the matching non-confirmed Settlement if one exists".
  it("after a partial sent Settlement, the Ploy → Act transfer still shows that open Settlement", async () => { // BUG-3
    const sent = await report("ploy", { toId: M("act"), amount: 100_000 });
    const res = await request(app()).get(`/api/trips/${T}/balances`).set(as("ploy"));
    const tr = res.body.transfers.find((x: { from: { id: string } }) => x.from.id === M("ploy"));
    expect(tr.settlement?.id).toBe(sent.body.id);
  });
});
