import { ObjectId } from "mongodb";

/** New documents get an ObjectId hex string as `_id` (docs/db/schema.md §0). */
export const newId = (): string => new ObjectId().toHexString();

/** E11000 duplicate key. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}
