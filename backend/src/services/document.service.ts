import { newId } from "../db/ids.js";
import { sniffDocumentMime } from "../domain/file-type.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { deleteDocument, findDocument, findDocumentById, insertDocument, isUsedAsSlip, listDocuments } from "../models/document.model.js";
import type { UploadDocumentInput } from "../schemas/document.inputs.js";
import type { DocumentDoc, MemberDoc } from "../schemas/models.js";
import { readStoredFile, removeFiles, saveFile, signedFileUrl, verifyFileSignature } from "../storage/files.js";
import type { z } from "zod";

const notFound = () => new HttpError(404, "document_not_found", "ไม่พบเอกสารนี้");

async function loadDocument(tripId: string, docId: string): Promise<DocumentDoc> {
  const doc = await findDocument(tripId, docId);
  if (!doc) throw notFound();
  return doc;
}

/** A6 (no file URLs). */
export function list(tripId: string): Promise<DocumentDoc[]> {
  return listDocuments(tripId);
}

export function get(tripId: string, docId: string): Promise<DocumentDoc> {
  return loadDocument(tripId, docId);
}

/**
 * B12 — owner/editor for trip documents; any Member for `kind=slip` (a viewer reports transfers
 * with a slip). The type is taken from the file's bytes, not the client's mime.
 */
export async function upload(me: MemberDoc, input: z.infer<typeof UploadDocumentInput>, file: { buffer: Buffer; size: number } | null): Promise<DocumentDoc> {
  if (me.role === "viewer" && input.kind !== "slip") throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  if (!file) throw new HttpError(400, "file_required", "กรุณาเลือกไฟล์");
  const mime = sniffDocumentMime(file.buffer);
  if (!mime) throw new HttpError(400, "unsupported_file_type", "รองรับเฉพาะไฟล์ PDF และรูปภาพ (JPEG, PNG, HEIC, WebP)");

  const _id = newId();
  const doc: DocumentDoc = {
    _id,
    tripId: me.tripId,
    name: input.name ?? (input.kind === "slip" ? "สลิป" : "เอกสาร"),
    fileKey: `${me.tripId}/${_id}`,
    mime,
    size: file.size,
    uploadedBy: me._id,
    createdAt: new Date(),
  };
  await saveFile(doc.fileKey, file.buffer, mime);
  await insertDocument(doc);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: _id, text: `อัปโหลดเอกสาร "${doc.name}"` });
  return doc;
}

/** B13 — expires in 5 minutes. */
export async function signedUrl(tripId: string, docId: string): Promise<{ url: string; expiresAt: Date }> {
  const doc = await loadDocument(tripId, docId);
  return signedFileUrl({
    fileKey: doc.fileKey,
    mime: doc.mime,
    filename: doc.name,
    local: { path: `/api/files/${encodeURIComponent(doc._id)}`, subject: doc._id },
  });
}

/** B14 — owner or uploader; a slip in use → 409. */
export async function remove(me: MemberDoc, docId: string): Promise<void> {
  const doc = await loadDocument(me.tripId, docId);
  if (me.role !== "owner" && doc.uploadedBy !== me._id) throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  if (await isUsedAsSlip(me.tripId, doc._id)) {
    throw new HttpError(409, "document_in_use", "เอกสารนี้เป็นสลิปของรายการค่าใช้จ่ายหรือการโอน");
  }
  await deleteDocument(me.tripId, doc._id);
  await removeFiles([doc.fileKey]);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: null, text: `ลบเอกสาร "${doc.name}"` });
}

/** Public, but only with a valid unexpired signature (`query` null = malformed). */
export async function serve(docId: string, query: { exp: number; sig: string } | null): Promise<{ doc: DocumentDoc; bytes: Buffer }> {
  if (!query || !verifyFileSignature(docId, query.exp, query.sig)) {
    throw new HttpError(403, "invalid_signature", "ลิงก์หมดอายุหรือไม่ถูกต้อง");
  }
  const doc = await findDocumentById(docId);
  const bytes = doc ? await readStoredFile(doc.fileKey) : null;
  if (!doc || !bytes) throw notFound();
  return { doc, bytes };
}
