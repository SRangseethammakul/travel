/**
 * QA: Personal Expenses (API.md B44–B47, "Personal Expenses (ค่าใช้จ่ายส่วนตัว)"), CONTEXT.md
 * "Personal Expense", docs/db/schema.md Personal Expense section.
 * Black-box: seed + supertest only; the DB is read directly only to check cleanup.
 *
 * Seed: Tokyo (2026-12-12 … 2026-12-15) act owner; mint, beam, ploy editors.
 * Act has 3 Personal Expenses in Tokyo: pe-coffee (12-12), pe-donki (12-13), pe-taxi (12-14).
 * Japan (2027-03-20 … 2027-03-28): act owner, n editor.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, expectIsoDate, expectTimestamp, J, mid, T } from "./qa-helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const P = (tripId = T) => `/api/trips/${tripId}/personal-expenses`;
const M = (k: string) => mid(T, k);

const valid = { title: "ของฝาก", category: "shopping", amount: 300_000, method: "card", date: "2026-12-13" };

const list = (user: string, tripId = T) => request(app()).get(P(tripId)).set(as(user));
const create = (user: string, body: object, tripId = T) => request(app()).post(P(tripId)).set(as(user)).send(body);
const patch = (user: string, id: string, body: object, tripId = T) => request(app()).patch(`${P(tripId)}/${id}`).set(as(user)).send(body);
const del = (user: string, id: string, tripId = T) => request(app()).delete(`${P(tripId)}/${id}`).set(as(user));
const ids = (body: { id: string }[]) => body.map((r) => r.id);

async function createOk(user: string, body: object = valid, tripId = T): Promise<string> {
  const res = await create(user, body, tripId);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
}

beforeEach(() => t.reseed());

describe("shape and sort (B44, B45, B46)", () => {
  it("GET: my records sorted by date, PersonalExpense shape with `id`, ISO dates, THB, baseAmount = amount", async () => {
    const res = await list("act");
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual(["pe-coffee", "pe-donki", "pe-taxi"]);
    for (const r of res.body) {
      expectIdNotUnderscore(r);
      expect(r.tripId).toBe(T);
      expect(r.ownerId).toBe(M("act"));
      expect(r.currency).toBe("THB");
      expect(r.baseAmount).toBe(r.amount);
      expect(Number.isInteger(r.amount)).toBe(true);
      expectIsoDate(r.date);
      expectTimestamp(r.createdAt);
      // API.md: PersonalExpense has no payer, Shares or slip.
      expect(r).not.toHaveProperty("payerId");
      expect(r).not.toHaveProperty("shares");
      expect(r).not.toHaveProperty("slip");
    }
  });

  it("POST → 201 PersonalExpense; server sets ownerId, currency, baseAmount; no `note` key when not sent", async () => {
    const res = await create("mint", valid);
    expect(res.status).toBe(201);
    expectIdNotUnderscore(res.body);
    expect(res.body).toMatchObject({ ...valid, tripId: T, ownerId: M("mint"), currency: "THB", baseAmount: 300_000 });
    expect(res.body).not.toHaveProperty("note");
    expect(res.body).not.toHaveProperty("updatedAt");
    expectTimestamp(res.body.createdAt);
  });

  it("POST with note → note returned; GET returns the same record", async () => {
    const res = await create("mint", { ...valid, note: "ฝากแม่" });
    expect(res.status).toBe(201);
    expect(res.body.note).toBe("ฝากแม่");
    expect((await list("mint")).body).toEqual([res.body]);
  });

  it("GET sorts by date, then createdAt (same-day records keep insert order)", async () => {
    const a = await createOk("mint", { ...valid, title: "A", date: "2026-12-14" });
    const b = await createOk("mint", { ...valid, title: "B", date: "2026-12-14" });
    const c = await createOk("mint", { ...valid, title: "C", date: "2026-12-12" });
    expect(ids((await list("mint")).body)).toEqual([c, a, b]);
  });

  it("PATCH → 200 PersonalExpense with updatedAt; amount change also updates baseAmount", async () => {
    const res = await patch("act", "pe-donki", { amount: 250_000, category: "food", title: "ขนม" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "pe-donki", amount: 250_000, baseAmount: 250_000, category: "food", title: "ขนม", ownerId: M("act") });
    expectTimestamp(res.body.updatedAt);
  });

  it("PATCH note: null removes the note", async () => {
    const id = await createOk("mint", { ...valid, note: "ฝากแม่" });
    const res = await patch("mint", id, { note: null });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("note");
    expect((await list("mint")).body[0]).not.toHaveProperty("note");
  });

  it("DELETE → 204 with empty body; record gone from GET", async () => {
    const res = await del("act", "pe-donki");
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(ids((await list("act")).body)).toEqual(["pe-coffee", "pe-taxi"]);
  });

  it("DELETE twice → second is 404", async () => {
    expect((await del("act", "pe-donki")).status).toBe(204);
    expectError(await del("act", "pe-donki"), 404);
  });
});

describe("auth and membership", () => {
  it("signed out → 401 on GET, POST, PATCH, DELETE", async () => {
    expectError(await request(app()).get(P()), 401);
    expectError(await request(app()).post(P()).send(valid), 401);
    expectError(await request(app()).patch(`${P()}/pe-donki`).send({ title: "x" }), 401);
    expectError(await request(app()).delete(`${P()}/pe-donki`), 401);
  });

  it("not a Member → 404 on every endpoint", async () => {
    expectError(await list("n"), 404);
    expectError(await create("n", valid), 404);
    expectError(await patch("n", "pe-donki", { title: "x" }), 404);
    expectError(await del("n", "pe-donki"), 404);
  });

  it("pending Member → 404", async () => {
    await addN("viewer", "pending");
    expectError(await list("n"), 404);
    expectError(await create("n", valid), 404);
  });

  it("removed Member → 404", async () => {
    await addN("viewer", "removed");
    expectError(await list("n"), 404);
    expectError(await create("n", valid), 404);
  });

  it("unknown trip → 404", async () => {
    expectError(await list("act", "no-such-trip"), 404);
    expectError(await create("act", valid, "no-such-trip"), 404);
  });
});

describe("privacy: only the owner of a record sees or changes it", () => {
  it("other Members, including the trip owner, never see my records in GET", async () => {
    const id = await createOk("mint");
    expect(ids((await list("act")).body)).not.toContain(id);
    for (const user of ["beam", "ploy"]) expect((await list(user)).body).toEqual([]);
    expect(ids((await list("mint")).body)).toEqual([id]);
  });

  it("trip owner PATCH another Member's record → 404 personal_expense_not_found, record unchanged", async () => {
    const created = await create("mint", valid);
    const res = await patch("act", created.body.id, { title: "แก้โดยเจ้าของทริป" });
    expectError(res, 404);
    expect(res.body.error.code).toBe("personal_expense_not_found");
    expect((await list("mint")).body).toEqual([created.body]);
  });

  it("trip owner DELETE another Member's record → 404, record still there", async () => {
    const id = await createOk("mint");
    expectError(await del("act", id), 404);
    expect(ids((await list("mint")).body)).toEqual([id]);
  });

  it("editor PATCH/DELETE the owner's record → 404", async () => {
    expectError(await patch("mint", "pe-donki", { amount: 1 }), 404);
    expectError(await del("mint", "pe-donki"), 404);
    expect(ids((await list("act")).body)).toEqual(["pe-coffee", "pe-donki", "pe-taxi"]);
  });

  it("someone else's record and an unknown id give the same 404 body (no existence leak)", async () => {
    const other = await patch("mint", "pe-donki", { title: "x" });
    const unknown = await patch("mint", "no-such-id", { title: "x" });
    expect(other.status).toBe(404);
    expect(other.body).toEqual(unknown.body);
    expect((await del("mint", "pe-donki")).body).toEqual((await del("mint", "no-such-id")).body);
  });

  it("id from another trip → 404 (my own record in Japan, via the Tokyo path)", async () => {
    const id = await createOk("act", { ...valid, date: "2027-03-21" }, J);
    expectError(await patch("act", id, { title: "x" }), 404);
    expectError(await del("act", id), 404);
    expect(ids((await list("act", J)).body)).toEqual([id]);
    expect(ids((await list("act")).body)).not.toContain(id);
  });

  it("a Personal Expense id is not an Expense: GET/DELETE /expenses/:id → 404", async () => {
    expectError(await request(app()).get(`/api/trips/${T}/expenses/pe-donki`).set(as("act")), 404);
    expectError(await request(app()).delete(`/api/trips/${T}/expenses/pe-donki`).set(as("act")), 404);
    expect(ids((await list("act")).body)).toContain("pe-donki");
  });

  it("body cannot set ownerId to someone else → 400", async () => {
    expectError(await create("mint", { ...valid, ownerId: M("act") }), 400);
    expectError(await patch("act", "pe-donki", { ownerId: M("mint") }), 400);
  });
});

describe("viewer can manage their own records", () => {
  beforeEach(() => addN("viewer"));

  it("viewer POST 201, PATCH 200, DELETE 204 on own record", async () => {
    const res = await create("n", valid);
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(M("n"));
    expect((await patch("n", res.body.id, { amount: 100 })).status).toBe(200);
    expect(ids((await list("n")).body)).toEqual([res.body.id]);
    expect((await del("n", res.body.id)).status).toBe(204);
    expect((await list("n")).body).toEqual([]);
  });

  it("viewer cannot see, PATCH or DELETE the owner's record → 404", async () => {
    expect((await list("n")).body).toEqual([]);
    expectError(await patch("n", "pe-donki", { title: "x" }), 404);
    expectError(await del("n", "pe-donki"), 404);
  });
});

describe("validation → 400 { error } with Thai message", () => {
  const bad400 = async (body: object, code?: string) => {
    const res = await create("act", body);
    expectError(res, 400);
    if (code) expect(res.body.error.code).toBe(code);
    return res;
  };

  it("unknown category → 400 invalid_input", () => bad400({ ...valid, category: "gift" }, "invalid_input"));
  it("category of wrong type → 400", () => bad400({ ...valid, category: 1 }));
  it("unknown method → 400 invalid_input", () => bad400({ ...valid, method: "bitcoin" }, "invalid_input"));
  it("amount 0 → 400", () => bad400({ ...valid, amount: 0 }, "invalid_input"));
  it("negative amount → 400", () => bad400({ ...valid, amount: -100 }, "invalid_input"));
  it("non-integer amount (1.5 satang) → 400", () => bad400({ ...valid, amount: 1.5 }, "invalid_input"));
  it("amount as string → 400", () => bad400({ ...valid, amount: "100" }, "invalid_input"));
  it("amount over ฿20,000,000 → 400", () => bad400({ ...valid, amount: 2_000_000_001 }, "invalid_input"));
  it("missing title → 400", () => bad400({ category: "food", amount: 100, method: "cash", date: "2026-12-13" }, "invalid_input"));
  it("blank title (only spaces) → 400", () => bad400({ ...valid, title: "   " }, "invalid_input"));
  it("title over 200 characters → 400", () => bad400({ ...valid, title: "ก".repeat(201) }, "invalid_input"));
  it("note over 2000 characters → 400", () => bad400({ ...valid, note: "ก".repeat(2001) }, "invalid_input"));
  it("bad date format 2026/12/13 → 400 invalid_input", () => bad400({ ...valid, date: "2026/12/13" }, "invalid_input"));
  it("impossible date 2026-02-30 → 400", () => bad400({ ...valid, date: "2026-02-30" }));
  it("date a day before the trip → 400 date_outside_trip", () => bad400({ ...valid, date: "2026-12-11" }, "date_outside_trip"));
  it("date a day after the trip → 400 date_outside_trip", () => bad400({ ...valid, date: "2026-12-16" }, "date_outside_trip"));
  it("missing date → 400", () => bad400({ title: "x", category: "food", amount: 100, method: "cash" }, "invalid_input"));
  it("missing method → 400", () => bad400({ title: "x", category: "food", amount: 100, date: "2026-12-13" }, "invalid_input"));

  it("server-owned fields in the body (tripId, currency, baseAmount, id, createdAt) → 400", async () => {
    for (const extra of [{ tripId: J }, { currency: "JPY" }, { baseAmount: 1 }, { id: "x" }, { createdAt: "2026-01-01T00:00:00.000Z" }, { payerId: M("act") }]) {
      expectError(await create("act", { ...valid, ...extra }), 400);
    }
  });

  it("boundaries accepted: amount 1 and ฿20,000,000; first and last trip day; title 200 chars", async () => {
    for (const body of [
      { ...valid, amount: 1 },
      { ...valid, amount: 2_000_000_000 },
      { ...valid, date: "2026-12-12" },
      { ...valid, date: "2026-12-15" },
      { ...valid, title: "ก".repeat(200) },
    ]) {
      const res = await create("act", body);
      expect(res.status, JSON.stringify({ body, res: res.body })).toBe(201);
    }
  });

  it("all 6 categories accepted (5 group + shopping)", async () => {
    for (const category of ["stay", "transport", "food", "activity", "other", "shopping"]) {
      expect((await create("act", { ...valid, category })).status).toBe(201);
    }
  });

  it("malformed JSON → 400", async () => {
    const res = await request(app()).post(P()).set(as("act")).set("Content-Type", "application/json").send("{ not json");
    expectError(res, 400);
  });

  it("PATCH empty body → 400", async () => {
    expectError(await patch("act", "pe-donki", {}), 400);
  });

  it("PATCH invalid fields → 400 (amount 0, category gift, method bitcoin, blank title, title null, unknown field)", async () => {
    for (const body of [{ amount: 0 }, { amount: 1.5 }, { category: "gift" }, { method: "bitcoin" }, { title: "  " }, { title: null }, { foo: 1 }, { date: "2026/12/13" }]) {
      expectError(await patch("act", "pe-donki", body), 400);
    }
    // Nothing changed.
    const donki = (await list("act")).body.find((r: { id: string }) => r.id === "pe-donki");
    expect(donki).toMatchObject({ title: "ของฝาก Don Quijote", amount: 300_000, category: "shopping", method: "card" });
  });

  it("PATCH date outside the trip → 400 date_outside_trip", async () => {
    const res = await patch("act", "pe-donki", { date: "2026-12-20" });
    expectError(res, 400);
    expect(res.body.error.code).toBe("date_outside_trip");
  });

  it("group Expenses still reject category shopping → 400", async () => {
    const res = await request(app())
      .post(`/api/trips/${T}/expenses`)
      .set(as("act"))
      .send({
        title: "ช็อป",
        category: "shopping",
        payerId: M("act"),
        method: "cash",
        amount: 30_000,
        splitMode: "equal",
        shares: [{ memberId: M("act") }, { memberId: M("mint") }],
        date: "2026-12-14",
      });
    expectError(res, 400);
  });

  it("group Expense PATCH to category shopping → 400", async () => {
    expectError(await request(app()).patch(`/api/trips/${T}/expenses/e-ramen`).set(as("act")).send({ category: "shopping" }), 400);
  });
});

describe("group money is unchanged by Personal Expenses", () => {
  async function snapshot() {
    const get = async (path: string) => {
      const res = await request(app()).get(`/api/trips/${T}/${path}`).set(as("act"));
      expect(res.status, path).toBe(200);
      return res.body;
    };
    return {
      expenses: await get("expenses"),
      balances: await get("balances"),
      settlements: await get("settlements"),
      summary: await get("summary"),
      activity: await get("activity"),
      activityCount: await activityCount(T),
      trip: await get(""),
    };
  }

  it("expenses, balances (total, Net, Outstanding, Suggested Transfers), settlements, summary and activity are identical after add, edit, delete", async () => {
    await addN("viewer");
    const before = await snapshot();
    expect(before.balances.total).toBe(3_035_000);

    await createOk("act", { ...valid, amount: 2_000_000_000 });
    const mintId = await createOk("mint", { ...valid, category: "food", amount: 99_900 });
    await createOk("n", { ...valid, category: "stay", amount: 1_000_000 });
    await patch("mint", mintId, { amount: 50_000 });
    await del("act", "pe-taxi");

    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it("balances seen by each Member are unchanged after they add personal records", async () => {
    const users = ["act", "mint", "beam", "ploy"];
    const before = await Promise.all(users.map(async (u) => (await request(app()).get(`/api/trips/${T}/balances`).set(as(u))).body));
    for (const u of users) await createOk(u, { ...valid, amount: 500_000 });
    const after = await Promise.all(users.map(async (u) => (await request(app()).get(`/api/trips/${T}/balances`).set(as(u))).body));
    expect(after).toEqual(before);
  });
});

describe("cleanup", () => {
  it("removing a Member (hard delete) deletes only their Personal Expenses", async () => {
    await addN("viewer");
    await createOk("n");
    await createOk("n", { ...valid, title: "อีกอัน" });
    const mintId = await createOk("mint");
    expect(await collections.personalExpenses().countDocuments({ tripId: T, ownerId: M("n") })).toBe(2);

    const res = await request(app()).delete(`/api/trips/${T}/members/${M("n")}`).set(as("act"));
    expect(res.status, JSON.stringify(res.body)).toBe(204);
    // N had no Expenses/Settlements, so this is a hard delete.
    expect(await collections.members().findOne({ _id: M("n") })).toBeNull();

    expect(await collections.personalExpenses().countDocuments({ tripId: T, ownerId: M("n") })).toBe(0);
    expect(ids((await list("act")).body)).toEqual(["pe-coffee", "pe-donki", "pe-taxi"]);
    expect(ids((await list("mint")).body)).toEqual([mintId]);
  });

  it("removing a Member does not touch their records in another trip", async () => {
    // N is an editor in Japan; give N a Tokyo membership and records in both trips.
    await addN("viewer");
    await createOk("n");
    const japanId = await createOk("n", { ...valid, date: "2027-03-22" }, J);
    expect((await request(app()).delete(`/api/trips/${T}/members/${M("n")}`).set(as("act"))).status).toBe(204);
    expect(ids((await list("n", J)).body)).toEqual([japanId]);
  });

  it("soft-removed Member (Mint: has Expenses, Outstanding 0): records kept but unreachable — 404 (schema.md open question 11)", async () => {
    await createOk("mint");
    expect((await request(app()).delete(`/api/trips/${T}/members/${M("mint")}`).set(as("act"))).status).toBe(204);
    expect(await collections.members().findOne({ _id: M("mint") })).toMatchObject({ status: "removed" });
    expectError(await list("mint"), 404);
    expectError(await create("mint", valid), 404);
    // Kept in the DB (documented choice, see Spec questions), invisible to everyone else.
    expect(await collections.personalExpenses().countDocuments({ tripId: T, ownerId: M("mint") })).toBe(1);
    expect(ids((await list("act")).body)).toEqual(["pe-coffee", "pe-donki", "pe-taxi"]);
  });

  it("deleting a trip removes all its Personal Expenses, and no other trip's", async () => {
    await createOk("mint");
    const japanId = await createOk("act", { ...valid, date: "2027-03-21" }, J);
    const res = await request(app()).delete(`/api/trips/${T}`).set(as("act"));
    expect(res.status, JSON.stringify(res.body)).toBe(204);
    expect(await collections.personalExpenses().countDocuments({ tripId: T })).toBe(0);
    expect(ids((await list("act", J)).body)).toEqual([japanId]);
    expectError(await list("act"), 404);
  });
});
