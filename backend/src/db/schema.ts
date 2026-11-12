import type { Db } from "mongodb";
import { collectionDefs } from "./validators.js";

const validation = { validationLevel: "strict", validationAction: "error" } as const;

/** Creates every collection with its validator and indexes. Safe to run on every start. */
export async function ensureSchema(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const def of collectionDefs) {
    if (existing.has(def.name)) {
      await db.command({ collMod: def.name, validator: def.validator, ...validation });
    } else {
      await db.createCollection(def.name, { validator: def.validator, ...validation });
    }
    if (def.indexes.length > 0) {
      await db.collection(def.name).createIndexes(def.indexes.map((i) => ({ key: i.key, ...i.options })));
    }
  }
}
