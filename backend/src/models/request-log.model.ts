import type { Filter } from "mongodb";
import { collections } from "../db/collections.js";
import { newId } from "../db/ids.js";
import type { RequestLogDoc } from "../schemas/models.js";

export type NewRequestLog = Omit<RequestLogDoc, "_id">;

export async function insertRequestLog(entry: NewRequestLog): Promise<void> {
  await collections.requestLogs().insertOne({ _id: newId(), ...entry });
}

/** The capped collection keeps insertion order, so `$natural: -1` is newest first without an index. */
export async function pageRequestLogs(filter: Filter<RequestLogDoc>, skip: number, limit: number) {
  const [items, total] = await Promise.all([
    collections.requestLogs().find(filter).sort({ $natural: -1 }).skip(skip).limit(limit).toArray(),
    collections.requestLogs().countDocuments(filter),
  ]);
  return { items, total };
}

/** Entries since `from`, newest first (at most 1,000: the collection cap). */
export function requestLogsSince(from: Date, projection: Partial<Record<keyof RequestLogDoc, 1>>): Promise<Partial<RequestLogDoc>[]> {
  return collections.requestLogs().find({ at: { $gte: from } }, { projection }).sort({ $natural: -1 }).toArray();
}
