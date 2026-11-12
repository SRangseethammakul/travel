import { Double, MongoServerError } from "mongodb";
import { describe, expect, it } from "vitest";
import { activeMemberFilter } from "../models/member.model.js";
import { createSeed } from "../seed/data.js";
import { TEST_NOW, useTestDb } from "../test/helpers.js";
import { ensureSchema } from "./schema.js";
import { collectionDefs } from "./validators.js";

const t = useTestDb();
/** Untyped collection, so tests can insert documents the TS types would not allow. */
const raw = (name: string) => t.db().collection<{ _id: string; [key: string]: unknown }>(name);
const seedData = createSeed(TEST_NOW);

async function expectRejected(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(MongoServerError);
  expect((err as MongoServerError).code).toBe(121); // DocumentValidationFailure
}

/** Walks an explain() tree and returns every plan stage node. */
function stages(node: unknown): { stage?: string; indexName?: string }[] {
  if (typeof node !== "object" || node === null) return [];
  const self = "stage" in node ? [node as { stage?: string; indexName?: string }] : [];
  return [...self, ...Object.values(node).flatMap(stages)];
}

describe("schema validators", () => {
  it("accept every seed document (seed ran in beforeAll)", async () => {
    expect(await t.db().collection("trips").countDocuments()).toBe(4);
  });

  it("reject money stored as a double", async () => {
    const expense = { ...seedData.expenses[0]!, _id: "bad-double", amount: new Double(2_200_000) };
    await expectRejected(raw("expenses").insertOne(expense));
    const fractional = { ...seedData.expenses[0]!, _id: "bad-fraction", amount: 1500.5 };
    await expectRejected(raw("expenses").insertOne(fractional));
  });

  it("reject a wrong enum value", async () => {
    await expectRejected(raw("members").insertOne({ ...seedData.members[0]!, _id: "bad-role", role: "admin" }));
  });

  it("reject a personal checklist item without ownerId", async () => {
    const item = { ...seedData.checklistItems.find((c) => c.scope === "personal")!, _id: "bad-personal" };
    delete item.ownerId;
    await expectRejected(raw("checklistItems").insertOne(item));
  });

  it("reject a confirmed Settlement without confirmedAt", async () => {
    const s = { ...seedData.settlements.find((x) => x.status === "confirmed")!, _id: "bad-confirmed" };
    delete s.confirmedAt;
    await expectRejected(raw("settlements").insertOne(s));
  });

  it("reject unknown fields", async () => {
    await expectRejected(raw("users").insertOne({ ...seedData.users[0]!, _id: "typo", nmae: "x" }));
  });
});

describe("indexes", () => {
  it("exist with the names in docs/db/schema.md", async () => {
    const expected = [
      "users_provider_subject",
      "members_user_trip",
      "members_trip",
      "invites_token",
      "documents_trip",
      "places_trip_city_area",
      "places_tagIds",
      "tags_owner_name",
      "planItems_trip_day_time",
      "expenses_trip_date",
      "settlements_trip",
      "settlements_open_pair",
      "checklist_trip_scope_owner",
      "activities_trip_created",
      "activities_trip_type_created",
    ];
    const names: string[] = [];
    for (const def of collectionDefs) {
      const indexes = await t.db().collection(def.name).listIndexes().toArray();
      names.push(...indexes.map((i) => String(i.name)).filter((n) => n !== "_id_"));
    }
    expect(names.sort()).toEqual([...expected].sort());
  });

  it("ensureSchema can run again on an existing database", async () => {
    await expect(ensureSchema(t.db())).resolves.toBeUndefined();
  });

  it("the Current Member lookup uses members_user_trip (IXSCAN)", async () => {
    const plan = await t.db().collection("members").find(activeMemberFilter("act", "tokyo-winter")).explain();
    const used = stages(plan).filter((s) => /IXSCAN/.test(s.stage ?? ""));
    expect(used.map((s) => s.indexName)).toContain("members_user_trip");
  });
});
