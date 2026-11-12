/**
 * QA: Expenses (API.md A11, A12, B29–B31) and how they move Net Balance / Outstanding / Suggested
 * Transfers (A14). Sources: SPEC "ค่าใช้จ่ายและการหาร", first-backend.md "เงิน" and "สิทธิ์".
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, expectIsoDate, expectTimestamp, K, mid, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const base = `/api/trips/${T}/expenses`;
const M = (k: string) => mid(T, k);

const valid = {
  title: "ข้าวเย็น",
  category: "food",
  payerId: M("mint"),
  method: "cash",
  amount: 30_000,
  splitMode: "equal",
  shares: [{ memberId: M("act") }, { memberId: M("mint") }, { memberId: M("beam") }],
  date: "2026-12-14",
};
const post = (user: string, body: object) => request(app()).post(base).set(as(user)).send(body);

type Row = { member: { id: string }; paid: number; share: number; net: number; outstanding: number };
async function balances(user = "act") {
  const res = await request(app()).get(`/api/trips/${T}/balances`).set(as(user));
  expect(res.status).toBe(200);
  const rows = Object.fromEntries((res.body.rows as Row[]).map((r) => [r.member.id, r]));
  return { body: res.body as { total: number; transfers: { from: { id: string }; to: { id: string }; amount: number; settlement: { status: string } | null }[] }, rows };
}

beforeEach(() => t.reseed());

describe("reads", () => {
  it("GET expenses: Expense[] sorted by date then createdAt, ids as `id`, ISO dates", async () => {
    const res = await request(app()).get(base).set(as("ploy"));
    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual(["e-hotel", "e-subway", "e-ramen", "e-skytree", "e-shabu"]);
    for (const e of res.body) {
      expectIdNotUnderscore(e);
      expectIsoDate(e.date);
      expectTimestamp(e.createdAt);
      expect(e.currency).toBe("THB");
      expect(e.baseAmount).toBe(e.amount);
      expect(e.tripId).toBe(T);
      for (const s of e.shares) expect(Number.isInteger(s.amount)).toBe(true);
    }
  });

  it("GET one Expense from another trip by id → 404", async () => {
    expectError(await request(app()).get(`${base}/k-resort`).set(as("act")), 404);
  });

  it("Tokyo seed numbers: total ฿30,350; Net and Outstanding per Member (SPEC table)", async () => {
    const { body, rows } = await balances();
    expect(body.total).toBe(3_035_000);
    expect(rows[M("act")]).toMatchObject({ paid: 2_200_000, share: 795_000, net: 1_405_000, outstanding: 1_095_000 });
    expect(rows[M("mint")]).toMatchObject({ paid: 450_000, share: 760_000, net: -310_000, outstanding: 0 });
    expect(rows[M("beam")]).toMatchObject({ paid: 105_000, share: 685_000, net: -580_000, outstanding: -580_000 });
    expect(rows[M("ploy")]).toMatchObject({ paid: 280_000, share: 795_000, net: -515_000, outstanding: -515_000 });
  });

  it("Suggested Transfers: Beam → Act ฿5,800 carries the sent Settlement, Ploy → Act ฿5,150 has none", async () => {
    const { body } = await balances();
    const tr = Object.fromEntries(body.transfers.map((x) => [`${x.from.id}>${x.to.id}`, x]));
    expect(Object.keys(tr).sort()).toEqual([`${M("beam")}>${M("act")}`, `${M("ploy")}>${M("act")}`]);
    expect(tr[`${M("beam")}>${M("act")}`]).toMatchObject({ amount: 580_000, settlement: { status: "sent" } });
    expect(tr[`${M("ploy")}>${M("act")}`]).toMatchObject({ amount: 515_000, settlement: null });
  });

  it("GET /summary returns the same Tokyo numbers", async () => {
    const res = await request(app()).get(`/api/trips/${T}/summary`).set(as("beam"));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3_035_000);
  });
});

describe("create — happy path and splitting", () => {
  it("editor creates an Expense → 201, currency THB, baseAmount = amount, createdBy = Current Member, Shares resolved", async () => {
    const res = await post("mint", valid);
    expect(res.status).toBe(201);
    expectIdNotUnderscore(res.body);
    expect(res.body).toMatchObject({ currency: "THB", baseAmount: 30_000, amount: 30_000, createdBy: M("mint"), tripId: T });
    expect(res.body.shares).toEqual([
      { memberId: M("act"), amount: 10_000 },
      { memberId: M("mint"), amount: 10_000 },
      { memberId: M("beam"), amount: 10_000 },
    ]);
    expectTimestamp(res.body.createdAt);
  });

  it("equal: leftover satang goes to the payer when the payer shares", async () => {
    const res = await post("mint", { ...valid, amount: 100 });
    const byId = Object.fromEntries(res.body.shares.map((s: { memberId: string; amount: number }) => [s.memberId, s.amount]));
    expect(byId).toEqual({ [M("act")]: 33, [M("mint")]: 34, [M("beam")]: 33 });
  });

  it("equal: leftover satang goes to the first listed Member when the payer does not share", async () => {
    const res = await post("mint", { ...valid, amount: 100, shares: [{ memberId: M("beam") }, { memberId: M("act") }, { memberId: M("ploy") }] });
    const byId = Object.fromEntries(res.body.shares.map((s: { memberId: string; amount: number }) => [s.memberId, s.amount]));
    expect(byId).toEqual({ [M("beam")]: 34, [M("act")]: 33, [M("ploy")]: 33 });
  });

  it("shares: weights are resolved into amounts that sum exactly, leftover to the payer", async () => {
    const res = await post("mint", {
      ...valid,
      amount: 1_000,
      splitMode: "shares",
      shares: [{ memberId: M("mint"), weight: 1 }, { memberId: M("act"), weight: 2 }],
    });
    expect(res.status).toBe(201);
    const byId = Object.fromEntries(res.body.shares.map((s: { memberId: string; amount: number }) => [s.memberId, s.amount]));
    expect(byId).toEqual({ [M("mint")]: 334, [M("act")]: 666 });
  });

  it("amount: Shares summing exactly to the amount are accepted", async () => {
    const res = await post("mint", { ...valid, splitMode: "amount", shares: [{ memberId: M("act"), amount: 20_000 }, { memberId: M("mint"), amount: 10_000 }] });
    expect(res.status).toBe(201);
  });

  it("card: cardLast4 is stored; promptpay: slipDocId from this trip is stored", async () => {
    const card = await post("mint", { ...valid, method: "card", cardLast4: "1234" });
    expect(card.status).toBe(201);
    expect(card.body.cardLast4).toBe("1234");
    const pp = await post("mint", { ...valid, method: "promptpay", slipDocId: "doc-insurance" });
    expect(pp.status).toBe(201);
    expect(pp.body.slipDocId).toBe("doc-insurance");
  });

  it("an Unclaimed Member can pay and share (khao-yai Kong)", async () => {
    const res = await request(app())
      .post(`/api/trips/${K}/expenses`)
      .set(as("mint"))
      .send({ ...valid, payerId: mid(K, "kong"), shares: [{ memberId: mid(K, "kong") }, { memberId: mid(K, "mint") }], date: "2026-06-13" });
    expect(res.status).toBe(201);
  });
});

describe("create — validation (400, Thai message)", () => {
  const cases: [string, object][] = [
    ["float amount", { amount: 100.5 }],
    ["negative amount", { amount: -100 }],
    ["zero amount", { amount: 0 }],
    ["amount over ฿20,000,000", { amount: 2_000_000_001 }],
    ["amount as a string", { amount: "30000" }],
    ["missing title", { title: undefined }],
    ["blank title", { title: "   " }],
    ["unknown category", { category: "shopping" }],
    ["unknown method", { method: "bitcoin" }],
    ["unknown splitMode", { splitMode: "random" }],
    ["empty shares", { shares: [] }],
    ["duplicate Member in shares", { shares: [{ memberId: M("act") }, { memberId: M("act") }] }],
    ["sharer from another trip", { shares: [{ memberId: mid(K, "kong") }] }],
    ["payer from another trip", { payerId: mid(K, "mint") }],
    ["unknown payer", { payerId: "nobody" }],
    ["extra unknown field", { hacker: true }],
    ["client-sent currency", { currency: "JPY" }],
    ["client-sent createdBy", { createdBy: M("act") }],
    ["cardLast4 not 4 digits", { method: "card", cardLast4: "12a4" }],
    ["cardLast4 with cash", { method: "cash", cardLast4: "1234" }],
    ["slipDocId from another trip / unknown", { method: "promptpay", slipDocId: "no-such-doc" }],
    ["date not YYYY-MM-DD", { date: "14/12/2026" }],
    ["amount mode: shares 1 satang short", { splitMode: "amount", shares: [{ memberId: M("act"), amount: 20_000 }, { memberId: M("mint"), amount: 9_999 }] }],
    ["amount mode: shares 1 satang over", { splitMode: "amount", shares: [{ memberId: M("act"), amount: 20_000 }, { memberId: M("mint"), amount: 10_001 }] }],
    ["amount mode: float share", { splitMode: "amount", shares: [{ memberId: M("act"), amount: 15_000.5 }, { memberId: M("mint"), amount: 14_999.5 }] }],
    ["amount mode: negative share", { splitMode: "amount", shares: [{ memberId: M("act"), amount: 40_000 }, { memberId: M("mint"), amount: -10_000 }] }],
    ["shares mode: zero weight", { splitMode: "shares", shares: [{ memberId: M("act"), weight: 0 }, { memberId: M("mint"), weight: 1 }] }],
    ["shares mode: float weight", { splitMode: "shares", shares: [{ memberId: M("act"), weight: 1.5 }, { memberId: M("mint"), weight: 1 }] }],
  ];
  for (const [name, patch] of cases) {
    it(`${name} → 400`, async () => {
      const before = await activityCount(T);
      expectError(await post("mint", { ...valid, ...patch }), 400);
      expect(await activityCount(T)).toBe(before);
    });
  }

  // first-backend.md: วันที่ปฏิทินเป็น string `YYYY-MM-DD` — an impossible calendar date is not a date.
  it("date that is not a real calendar day (2026-13-45) → 400", async () => { // BUG-1
    expectError(await post("mint", { ...valid, date: "2026-13-45" }), 400);
  });

  it("a pending Member cannot be the payer (not an active Member)", async () => {
    await addN("editor", "pending");
    expectError(await post("mint", { ...valid, payerId: M("n") }), 400);
  });
});

describe("edit / delete — role matrix (SPEC สิทธิ์: editor แก้หรือลบได้เฉพาะค่าใช้จ่ายที่ตัวเองสร้าง)", () => {
  it("owner can edit another Member's Expense → 200, updatedBy/updatedAt set", async () => {
    const res = await request(app()).patch(`${base}/e-ramen`).set(as("act")).send({ title: "ราเมง" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "ราเมง", updatedBy: M("act"), createdBy: M("mint") });
    expectTimestamp(res.body.updatedAt);
  });

  it("owner can delete another Member's Expense → 204", async () => {
    expect((await request(app()).delete(`${base}/e-ramen`).set(as("act"))).status).toBe(204);
    expectError(await request(app()).get(`${base}/e-ramen`).set(as("act")), 404);
  });

  it("editor can edit their own Expense → 200", async () => {
    expect((await request(app()).patch(`${base}/e-ramen`).set(as("mint")).send({ title: "x" })).status).toBe(200);
  });

  it("editor can delete their own Expense → 204", async () => {
    expect((await request(app()).delete(`${base}/e-ramen`).set(as("mint"))).status).toBe(204);
  });

  it("editor cannot edit another Member's Expense → 403", async () => {
    expectError(await request(app()).patch(`${base}/e-hotel`).set(as("mint")).send({ title: "x" }), 403);
  });

  it("editor cannot delete another Member's Expense → 403", async () => {
    expectError(await request(app()).delete(`${base}/e-hotel`).set(as("mint")), 403);
    expect((await request(app()).get(`${base}/e-hotel`).set(as("act"))).status).toBe(200);
  });

  it("editor who is in the Shares but not the creator still cannot edit → 403", async () => {
    // Ploy shares e-hotel (created by Act).
    expectError(await request(app()).patch(`${base}/e-hotel`).set(as("ploy")).send({ amount: 1 }), 403);
  });

  it("viewer cannot edit even an Expense they created earlier as editor → 403", async () => {
    const created = await post("ploy", { ...valid, payerId: M("ploy") });
    await request(app()).patch(`/api/trips/${T}/members/${M("ploy")}`).set(as("act")).send({ role: "viewer" });
    expectError(await request(app()).patch(`${base}/${created.body.id}`).set(as("ploy")).send({ title: "x" }), 403);
    expectError(await request(app()).delete(`${base}/${created.body.id}`).set(as("ploy")), 403);
  });

  it("PATCH / DELETE an Expense of another trip → 404", async () => {
    expectError(await request(app()).patch(`${base}/k-resort`).set(as("act")).send({ title: "x" }), 404);
    expectError(await request(app()).delete(`${base}/k-resort`).set(as("act")), 404);
  });

  it("PATCH that breaks the split (amount mode, new amount without new shares) → 400", async () => {
    const created = await post("mint", { ...valid, splitMode: "amount", shares: [{ memberId: M("act"), amount: 20_000 }, { memberId: M("mint"), amount: 10_000 }] });
    expectError(await request(app()).patch(`${base}/${created.body.id}`).set(as("mint")).send({ amount: 30_001 }), 400);
  });

  it("PATCH with an unknown field → 400", async () => {
    expectError(await request(app()).patch(`${base}/e-ramen`).set(as("mint")).send({ tripId: "khao-yai" }), 400);
  });
});

describe("Net Balance / Outstanding react to Expense changes", () => {
  it("add: Mint pays ฿300 split equally Act/Mint/Beam → Act −100, Mint +200, Beam −100", async () => {
    await post("mint", valid);
    const { body, rows } = await balances();
    expect(body.total).toBe(3_035_000 + 30_000);
    expect(rows[M("act")]!.net).toBe(1_405_000 - 10_000);
    expect(rows[M("mint")]!.net).toBe(-310_000 + 20_000);
    expect(rows[M("mint")]!.outstanding).toBe(20_000);
    expect(rows[M("beam")]!.net).toBe(-580_000 - 10_000);
    expect(rows[M("ploy")]!.net).toBe(-515_000);
  });

  it("edit: changing e-shabu's amount re-splits and moves the balances", async () => {
    // e-shabu ฿3,300 paid by Mint, Act/Mint/Ploy → ฿1,100 each. Make it ฿3,000 → ฿1,000 each.
    const res = await request(app()).patch(`${base}/e-shabu`).set(as("mint")).send({ amount: 300_000 });
    expect(res.status).toBe(200);
    const { body, rows } = await balances();
    expect(body.total).toBe(3_005_000);
    expect(rows[M("act")]!.net).toBe(1_405_000 + 10_000);
    expect(rows[M("mint")]!.net).toBe(-310_000 - 20_000);
    expect(rows[M("ploy")]!.net).toBe(-515_000 + 10_000);
  });

  it("delete: removing e-hotel takes ฿22,000 out and flips Act's Net Balance", async () => {
    expect((await request(app()).delete(`${base}/e-hotel`).set(as("act"))).status).toBe(204);
    const { body, rows } = await balances();
    expect(body.total).toBe(3_035_000 - 2_200_000);
    expect(rows[M("act")]!.net).toBe(1_405_000 - 2_200_000 + 550_000);
    const sum = Object.values(rows).reduce((s, r) => s + r.net, 0);
    expect(sum).toBe(0);
  });

  it("Net Balances always sum to 0 after any change", async () => {
    await post("mint", { ...valid, amount: 101 });
    await post("beam", { ...valid, payerId: M("beam"), amount: 99_999, splitMode: "shares", shares: [{ memberId: M("act"), weight: 3 }, { memberId: M("ploy"), weight: 7 }] });
    const { rows } = await balances();
    expect(Object.values(rows).reduce((s, r) => s + r.net, 0)).toBe(0);
  });
});

describe("side effects", () => {
  it("create, edit and delete each add one 'expense' Activity", async () => {
    const n0 = await activityCount(T);
    const created = await post("mint", valid);
    expect(await activityCount(T)).toBe(n0 + 1);
    await request(app()).patch(`${base}/${created.body.id}`).set(as("mint")).send({ title: "x" });
    expect(await activityCount(T)).toBe(n0 + 2);
    await request(app()).delete(`${base}/${created.body.id}`).set(as("mint"));
    expect(await activityCount(T)).toBe(n0 + 3);
    const feed = await request(app()).get(`/api/trips/${T}/activity?type=expense`).set(as("act"));
    expect(feed.body.slice(0, 3).every((a: { type: string; actorId: string }) => a.type === "expense" && a.actorId === M("mint"))).toBe(true);
  });

  it("a rejected write adds no Activity", async () => {
    const n0 = await activityCount(T);
    await request(app()).delete(`${base}/e-hotel`).set(as("mint"));
    expect(await activityCount(T)).toBe(n0);
  });
});
