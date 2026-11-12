import type { Filter } from "mongodb";
import { collections } from "../db/collections.js";
import type { SettlementDoc } from "../schemas/models.js";

/** A13 — oldest first (`settlements_trip`). */
export function findSettlements(tripId: string): Promise<SettlementDoc[]> {
  return collections
    .settlements()
    .find({ tripId })
    .sort({ createdAt: 1 })
    .toArray();
}

export function findSettlement(tripId: string, settlementId: string): Promise<SettlementDoc | null> {
  return collections.settlements().findOne({ _id: settlementId, tripId });
}

/** Throws E11000 when the pair already has a sent Settlement (`settlements_open_pair`). */
export async function insertSettlement(doc: SettlementDoc): Promise<void> {
  await collections.settlements().insertOne(doc);
}

/** Take back a report that is still `sent` (over-report found after insert, BUG-B6). */
export async function deleteSentSettlement(tripId: string, settlementId: string): Promise<void> {
  await collections.settlements().deleteOne({ _id: settlementId, tripId, status: "sent" });
}

/**
 * One conditional update: the filter holds the current status and who may act, so a wrong
 * person, a wrong status or a second click matches nothing and returns null.
 */
export function transitionSettlement(
  filter: Filter<SettlementDoc> & { _id: string; tripId: string },
  set: Partial<SettlementDoc>,
): Promise<SettlementDoc | null> {
  return collections.settlements().findOneAndUpdate(filter, { $set: set }, { returnDocument: "after" });
}

/** Sent Settlements to this Member among `ids` — Activity items that still need "ตรวจและยืนยัน". */
export async function sentToMember(tripId: string, toId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await collections
    .settlements()
    .find({ tripId, toId, status: "sent", _id: { $in: ids } }, { projection: { _id: 1 } })
    .toArray();
  return new Set(rows.map((r) => r._id));
}
