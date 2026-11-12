import { getDb } from "../db/client.js";

/** Throws if MongoDB does not answer. */
export async function pingDb(): Promise<void> {
  await getDb().command({ ping: 1 });
}
