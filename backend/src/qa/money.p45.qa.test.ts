/**
 * QA phase 4 (money) — gaps not covered by expenses.qa / settlements.qa / settlements.test:
 * Settlement receivers, the viewer's full "report with slip" flow, PATCH side effects, removed
 * Members in old Expenses, the Summary page shape, and Activity paging/validation.
 * Sources: SPEC "สิทธิ์", "ค่าใช้จ่ายและการหาร"; first-backend.md "เงิน", "สิทธิ์", "API"; API.md A14, A16, B29–B34, B39.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { collections } from "../db/collections.js";
import { as } from "../test/helpers.js";
import { p45App, PDF, upload, useP45Db } from "./p45-helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, expectTimestamp, K, mid, setMember, T } from "./qa-helpers.js";

const t = useP45Db("money");
const app = () => p45App();
const M = (k: string) => mid(T, k);
const api = `/api/trips/${T}`;

type Row = { member: { id: string }; paid: number; share: number; net: number; outstanding: number };
type SummaryRow = Row & { items: { expenseId: string; title: string; date: string; paid: number; share: number }[] };

async function rows(user = "act") {
  const res = await request(app()).get(`${api}/balances`).set(as(user));
  expect(res.status).toBe(200);
  return Object.fromEntries((res.body.rows as Row[]).map((r) => [r.member.id, r]));
}

beforeEach(() => t.reseed());

describe("Settlement report (B32) — who can receive", () => {
  it("without `amount` the Suggested Transfer is used (Ploy → Act ฿5,150)", async () => {
    const res = await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("act") });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fromId: M("ploy"), toId: M("act"), amount: 515_000, status: "sent" });
    expectIdNotUnderscore(res.body);
    expectTimestamp(res.body.createdAt);
    expectTimestamp(res.body.sentAt);
    expect(res.body.confirmedAt).toBeUndefined();
  });

  // first-backend.md "Member มี status … requireMember ผ่านเฉพาะ active"; Expenses already refuse
  // a pending payer/sharer, so a pending Member is not someone you can pay within the trip.
  it("receiver who is a pending Member (waiting for approval) → 400", async () => { // BUG-B1
    await addN("editor", "pending");
    const before = await activityCount(T);
    expectError(await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("n"), amount: 10_000 }), 400);
    expect(await activityCount(T)).toBe(before);
  });

  it("receiver who is a removed Member → 400", async () => {
    await addN("editor", "removed");
    expectError(await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("n"), amount: 10_000 }), 400);
  });

  // Q4(a) decided by the user 2026-11-12: the receiver must be owed money. Q4(b) revised by the user
  // 2026-11-12: an Unclaimed Member who is owed money may receive (they confirm after a Claim).
  it("receiver who is owed nothing (Mint, Outstanding 0) → 400", async () => {
    expectError(await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("mint"), amount: 10_000 }), 400);
  });

  // Seed Kong owes ฿660; paying ฿8,000 for Act makes Kong owed money.
  it("receiver who is an Unclaimed Member owed money → 201", async () => {
    const e = await request(app()).post(`/api/trips/${K}/expenses`).set(as("act"))
      .send({ title: "ค่าที่พัก", category: "stay", payerId: mid(K, "kong"), method: "cash", date: "2026-06-13", amount: 800_000, splitMode: "amount", shares: [{ memberId: mid(K, "act"), amount: 800_000 }] });
    expect(e.status).toBe(201);
    const res = await request(app()).post(`/api/trips/${K}/settlements`).set(as("act")).send({ toId: mid(K, "kong"), amount: 10_000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ toId: mid(K, "kong"), status: "sent" });
  });

  it("receiver who is an Unclaimed Member owed nothing → 400", async () => {
    expectError(await request(app()).post(`/api/trips/${K}/settlements`).set(as("act")).send({ toId: mid(K, "kong"), amount: 100 }), 400);
  });
});

// BUG-B6 (spec question Q4c, decided by the user 2026-11-12): a report plus the sender's other `sent`
// reports may not exceed what they owe (Outstanding).
describe("Settlement report — total sent vs what I owe", () => {
  it("Ploy owes ฿6,150, reports ฿6,150 to Act, then ฿100 to Mint (who is owed ฿1,000) → 400", async () => { // BUG-B6
    // Mint pays ฿1,000 for Ploy, so Mint is a second receiver who is owed money.
    const e = await request(app()).post(`${api}/expenses`).set(as("act"))
      .send({ title: "ค่าน้ำ", category: "food", payerId: M("mint"), method: "cash", date: "2026-12-14", amount: 100_000, splitMode: "amount", shares: [{ memberId: M("ploy"), amount: 100_000 }] });
    expect(e.status).toBe(201);
    expect((await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("act"), amount: 615_000 })).status).toBe(201);
    const over = await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("mint"), amount: 10_000 });
    expectError(over, 400);
    expect(over.body.error.code).toBe("amount_too_large");
  });
});

describe("viewer: report a transfer with a slip (SPEC สิทธิ์ ดูอย่างเดียว: แจ้งโอนเงินได้)", () => {
  it("viewer Ploy uploads a slip, reports with it, then replaces it while sent", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const slip = await upload(app(), T, "ploy", PDF, { kind: "slip" });
    expect(slip.status).toBe(201);
    const sent = await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("act"), slipDocId: slip.body.id });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ status: "sent", slipDocId: slip.body.id, amount: 515_000 });

    const slip2 = await upload(app(), T, "ploy", PDF, { kind: "slip" });
    const replaced = await request(app()).post(`${api}/settlements/${sent.body.id}/slip`).set(as("ploy")).send({ slipDocId: slip2.body.id });
    expect(replaced.status).toBe(200);
    expect(replaced.body.slipDocId).toBe(slip2.body.id);
  });

  it("viewer cannot confirm a transfer where they are only the payer → 403", async () => {
    await setMember(M("beam"), { role: "viewer" });
    expectError(await request(app()).post(`${api}/settlements/s-beam/confirm`).set(as("beam")), 403);
  });

  // SPEC QUESTION Q3 — API.md B33 says "self (receiver)" with no role; SPEC viewer row lists only แจ้งโอน.
  it("a viewer who is the receiver can confirm today (spec question)", async () => {
    await setMember(M("act"), { role: "viewer" });
    const res = await request(app()).post(`${api}/settlements/s-beam/confirm`).set(as("act"));
    expect(res.status).toBe(200);
  });
});

describe("Settlement side effects", () => {
  it("confirm and slip replacement each add one 'settlement' Activity pointing at the Settlement", async () => {
    const slip = await upload(app(), T, "beam", PDF, { kind: "slip" });
    let before = await activityCount(T);
    expect((await request(app()).post(`${api}/settlements/s-beam/slip`).set(as("beam")).send({ slipDocId: slip.body.id })).status).toBe(200);
    expect(await activityCount(T)).toBe(before + 1);
    before = await activityCount(T);
    expect((await request(app()).post(`${api}/settlements/s-beam/confirm`).set(as("act"))).status).toBe(200);
    expect(await activityCount(T)).toBe(before + 1);
    const latest = await request(app()).get(`${api}/activity?type=settlement&limit=1`).set(as("act"));
    expect(latest.body[0]).toMatchObject({ type: "settlement", refId: "s-beam", actorId: M("act") });
  });

  it("after the receiver confirms, the 'ตรวจและยืนยัน' action is gone from the feed", async () => {
    const before = await request(app()).get(`${api}/activity`).set(as("act"));
    expect(before.body.find((a: { id: string }) => a.id === "a-1").action).toBe("confirm_settlement");
    await request(app()).post(`${api}/settlements/s-beam/confirm`).set(as("act"));
    const after = await request(app()).get(`${api}/activity`).set(as("act"));
    expect(after.body.some((a: { action?: string }) => a.action === "confirm_settlement")).toBe(false);
  });
});

describe("Expense PATCH (B30) — payment-method details", () => {
  it("changing method card → cash drops cardLast4", async () => {
    const res = await request(app()).patch(`${api}/expenses/e-hotel`).set(as("act")).send({ method: "cash" });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe("cash");
    expect(res.body.cardLast4).toBeUndefined();
  });

  it("changing method promptpay → cash drops slipDocId", async () => {
    const slip = await upload(app(), T, "mint", PDF, { kind: "slip" });
    const created = await request(app()).post(`${api}/expenses`).set(as("mint")).send({
      title: "ค่ารถ", category: "transport", payerId: M("mint"), method: "promptpay", slipDocId: slip.body.id,
      amount: 9_000, splitMode: "equal", shares: [{ memberId: M("mint") }, { memberId: M("ploy") }], date: "2026-12-13",
    });
    expect(created.status).toBe(201);
    const res = await request(app()).patch(`${api}/expenses/${created.body.id}`).set(as("mint")).send({ method: "cash" });
    expect(res.status).toBe(200);
    expect(res.body.slipDocId).toBeUndefined();
  });

  it("cardLast4 with a non-card method in PATCH → 400", async () => {
    expectError(await request(app()).patch(`${api}/expenses/e-ramen`).set(as("mint")).send({ cardLast4: "1234" }), 400);
  });
});

describe("Expenses that name a removed Member (first-backend.md: soft remove keeps old Expenses)", () => {
  async function removeMint() {
    // Mint's Outstanding is 0 and her name is on Expenses → soft remove.
    expect((await request(app()).delete(`${api}/members/${M("mint")}`).set(as("act"))).status).toBe(204);
  }

  it("balances still count the removed Member's money: total ฿30,350, Act Net +฿14,050", async () => {
    await removeMint();
    const res = await request(app()).get(`${api}/balances`).set(as("act"));
    expect(res.body.total).toBe(3_035_000);
    const r = Object.fromEntries((res.body.rows as Row[]).map((x) => [x.member.id, x]));
    expect(r[M("act")]!.net).toBe(1_405_000);
    expect(r[M("mint")]!.net).toBe(-310_000);
  });

  it("owner can still fix the title of an old Expense that has the removed Member in its Shares", async () => { // BUG-B2
    await removeMint();
    const res = await request(app()).patch(`${api}/expenses/e-hotel`).set(as("act")).send({ title: "ที่พัก 3 คืน (แก้ชื่อ)" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.title).toBe("ที่พัก 3 คืน (แก้ชื่อ)");
  });

  it("owner can still delete such an Expense", async () => {
    await removeMint();
    expect((await request(app()).delete(`${api}/expenses/e-ramen`).set(as("act"))).status).toBe(204);
  });
});

describe("Summary (first-backend.md ช่วง 4: สัดส่วนตามหมวด, Net Balance ต่อคน พร้อมที่มา)", () => {
  it("byCategory adds up to the Tokyo total ฿30,350 with the right split per category", async () => {
    const res = await request(app()).get(`${api}/summary`).set(as("ploy"));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3_035_000);
    const byCat = Object.fromEntries((res.body.byCategory as { category: string; amount: number }[]).map((c) => [c.category, c.amount]));
    expect(byCat).toEqual({ stay: 2_200_000, transport: 105_000, food: 450_000, activity: 280_000 });
  });

  it("each Member's items (ที่มา) add up to their paid and share", async () => {
    const res = await request(app()).get(`${api}/summary`).set(as("ploy"));
    for (const row of res.body.rows as SummaryRow[]) {
      expect(row.items.reduce((s, i) => s + i.paid, 0), row.member.id).toBe(row.paid);
      expect(row.items.reduce((s, i) => s + i.share, 0), row.member.id).toBe(row.share);
      expect(row.net).toBe(row.paid - row.share);
    }
  });

  it("transfers match GET /balances", async () => {
    const [s, b] = await Promise.all([
      request(app()).get(`${api}/summary`).set(as("ploy")),
      request(app()).get(`${api}/balances`).set(as("ploy")),
    ]);
    expect(s.body.transfers).toEqual(b.body.transfers);
  });

  it("summary follows an added Expense (category 'other' appears)", async () => {
    await request(app()).post(`${api}/expenses`).set(as("beam")).send({
      title: "ของฝาก", category: "other", payerId: M("beam"), method: "cash", amount: 40_000,
      splitMode: "equal", shares: [{ memberId: M("beam") }, { memberId: M("ploy") }], date: "2026-12-15",
    });
    const res = await request(app()).get(`${api}/summary`).set(as("act"));
    expect(res.body.total).toBe(3_075_000);
    expect(res.body.byCategory).toContainEqual({ category: "other", amount: 40_000 });
    const r = await rows();
    expect(r[M("beam")]!.net).toBe(-580_000 + 20_000);
  });

  it("non-Member → 404; no User → 401", async () => {
    expectError(await request(app()).get(`${api}/summary`).set(as("n")), 404);
    expectError(await request(app()).get(`${api}/summary`), 401);
  });
});

describe("Activity (A16, B39)", () => {
  it("shape matches types.ts Activity: id, tripId, actorId, type, refId, text, createdAt ISO, readBy[]", async () => {
    const res = await request(app()).get(`${api}/activity`).set(as("mint"));
    expect(res.status).toBe(200);
    for (const a of res.body) {
      expectIdNotUnderscore(a);
      expect(a).toMatchObject({ tripId: T, actorId: expect.any(String), type: expect.stringMatching(/^(expense|settlement|plan|member)$/), text: expect.any(String) });
      expect(a.refId === null || typeof a.refId === "string").toBe(true);
      expectTimestamp(a.createdAt);
      expect(Array.isArray(a.readBy)).toBe(true);
    }
  });

  it("every ?type= returns only that type", async () => {
    for (const type of ["expense", "settlement", "plan", "member"]) {
      const res = await request(app()).get(`${api}/activity?type=${type}`).set(as("mint"));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((a: { type: string }) => a.type === type)).toBe(true);
    }
  });

  it("Activity text is neutral (no 'คุณ'), the UI swaps in the viewer's name (API.md A16)", async () => {
    await request(app()).post(`${api}/settlements`).set(as("ploy")).send({ toId: M("act") });
    const res = await request(app()).get(`${api}/activity?limit=1`).set(as("ploy"));
    expect(res.body[0].text).toContain("Act");
    expect(res.body[0].text).not.toContain("คุณ");
  });

  const badQueries = ["limit=0", "limit=101", "limit=abc", "before=yesterday", "type=expense,plan"];
  for (const q of badQueries) {
    it(`GET activity?${q} → 400`, async () => {
      expectError(await request(app()).get(`${api}/activity?${q}`).set(as("mint")), 400);
    });
  }

  it("default page is at most 50 items", async () => {
    const now = Date.now();
    await collections.activities().insertMany(
      Array.from({ length: 60 }, (_, i) => ({
        _id: `qa-many-${i}`, tripId: T, actorId: M("mint"), type: "plan" as const, refId: null, text: "x", createdAt: new Date(now + i), readBy: [],
      })),
    );
    const res = await request(app()).get(`${api}/activity`).set(as("mint"));
    expect(res.body).toHaveLength(50);
  });

  // first-backend.md "Activity: อ่านแบบแบ่งหน้า (limit 50 + cursor createdAt)" — paging must not lose items.
  it("paging with ?before= does not skip Activities created in the same millisecond", async () => { // BUG-B3
    const same = new Date("2030-01-01T00:00:00.000Z");
    await collections.activities().insertMany(
      ["qa-same-1", "qa-same-2", "qa-same-3"].map((_id) => ({
        _id, tripId: T, actorId: M("mint"), type: "plan" as const, refId: null, text: _id, createdAt: same, readBy: [],
      })),
    );
    const first = await request(app()).get(`${api}/activity?limit=2`).set(as("mint"));
    const firstIds = first.body.map((a: { id: string }) => a.id);
    const next = await request(app())
      .get(`${api}/activity?limit=50&before=${encodeURIComponent(first.body[1].createdAt)}`)
      .set(as("mint"));
    const allIds = [...firstIds, ...next.body.map((a: { id: string }) => a.id)];
    expect(allIds).toEqual(expect.arrayContaining(["qa-same-1", "qa-same-2", "qa-same-3"]));
  });

  it("POST activity/read with more than 500 ids → 400", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `x-${i}`);
    expectError(await request(app()).post(`${api}/activity/read`).set(as("mint")).send({ ids }), 400);
  });

  it("POST activity/read cannot mark an Activity of another trip", async () => {
    // Mint owns Khao Yai: her Expense there adds an Activity in that trip.
    await request(app()).post(`/api/trips/${K}/expenses`).set(as("mint")).send({
      title: "ข้าวเช้า", category: "food", payerId: mid(K, "mint"), method: "cash", amount: 20_000,
      splitMode: "equal", shares: [{ memberId: mid(K, "mint") }, { memberId: mid(K, "act") }], date: "2026-06-13",
    });
    const k = await collections.activities().findOne({ tripId: K }, { sort: { createdAt: -1 } });
    expect(k).not.toBeNull();
    // Beam is in Tokyo but not in Khao Yai.
    expect((await request(app()).post(`${api}/activity/read`).set(as("beam")).send({ ids: [k!._id] })).status).toBe(204);
    expect((await collections.activities().findOne({ _id: k!._id }))!.readBy).not.toContain("beam");
  });

  it("POST activity/read is idempotent: readBy holds the User once", async () => {
    await request(app()).post(`${api}/activity/read`).set(as("mint")).send({ ids: ["a-1"] });
    await request(app()).post(`${api}/activity/read`).set(as("mint")).send({ ids: ["a-1"] });
    const a = await collections.activities().findOne({ _id: "a-1" });
    expect(a!.readBy.filter((u) => u === "mint")).toHaveLength(1);
  });
});
