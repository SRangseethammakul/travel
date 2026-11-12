import type { Db } from "mongodb";
import { createSeed, type SeedData } from "./data.js";

/**
 * Wipes every seeded collection and inserts the 4 seed trips. Dev/test only.
 * Run `ensureSchema(db)` first so the validators check the seed.
 */
export async function seed(db: Db, now: Date = new Date()): Promise<void> {
  const data = createSeed(now);
  for (const [name, docs] of Object.entries(data) as [keyof SeedData, SeedData[keyof SeedData]][]) {
    const collection = db.collection<{ _id: string }>(name);
    await collection.deleteMany({});
    if (docs.length > 0) await collection.insertMany(docs);
  }
}
