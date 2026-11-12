import { collections } from "../db/collections.js";
import type { DocumentDoc } from "../schemas/models.js";

export function listDocuments(tripId: string): Promise<DocumentDoc[]> {
  return collections.documents().find({ tripId }).sort({ createdAt: 1, _id: 1 }).toArray();
}

export function findDocument(tripId: string, docId: string): Promise<DocumentDoc | null> {
  return collections.documents().findOne({ _id: docId, tripId });
}

/** For signed file URLs, which carry no trip context. */
export function findDocumentById(docId: string): Promise<DocumentDoc | null> {
  return collections.documents().findOne({ _id: docId });
}

export async function insertDocument(doc: DocumentDoc): Promise<void> {
  await collections.documents().insertOne(doc);
}

/** True when an Expense or Settlement uses this Document as its slip. */
export async function isUsedAsSlip(tripId: string, docId: string): Promise<boolean> {
  const [expense, settlement] = await Promise.all([
    collections.expenses().findOne({ tripId, slipDocId: docId }, { projection: { _id: 1 } }),
    collections.settlements().findOne({ tripId, slipDocId: docId }, { projection: { _id: 1 } }),
  ]);
  return expense !== null || settlement !== null;
}

/** Delete the Document and unlink it from Transit Plan Items (docs/db/schema.md §5.6). */
export async function deleteDocument(tripId: string, docId: string): Promise<void> {
  await collections.planItems().updateMany({ tripId, kind: "transit", docIds: docId }, { $pull: { docIds: docId } });
  await collections.documents().deleteOne({ _id: docId, tripId });
}
