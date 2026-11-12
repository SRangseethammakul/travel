import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { newId } from "../db/ids.js";
import { sniffDocumentMime } from "../domain/file-type.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { deleteDocument, findDocument, findDocumentById, insertDocument, isUsedAsSlip, listDocuments } from "../models/document.model.js";
import { SignedFileQuery, UploadDocumentInput } from "../schemas/document.inputs.js";
import type { DocumentDoc } from "../schemas/models.js";
import { readStoredFile, removeFile, saveFile, signedFileUrl, verifyFileSignature } from "../storage/files.js";
import { documentView } from "../views/document.view.js";
import { param } from "./params.js";

const notFound = () => new HttpError(404, "document_not_found", "ไม่พบเอกสารนี้");

async function loadDocument(tripId: string, docId: string): Promise<DocumentDoc> {
  const doc = await findDocument(tripId, docId);
  if (!doc) throw notFound();
  return doc;
}

/** A6 GET /api/trips/:tripId/documents (no file URLs). */
export const getDocuments: RequestHandler = async (req, res) => {
  res.json((await listDocuments(currentMember(req).tripId)).map(documentView));
};

/** GET /api/trips/:tripId/documents/:docId (frontend `getDocument`). */
export const getDocument: RequestHandler = async (req, res) => {
  res.json(documentView(await loadDocument(currentMember(req).tripId, param(req, "docId"))));
};

/**
 * B12 POST /api/trips/:tripId/documents (multipart `file` + `name`). Owner/editor for trip
 * documents; any Member for `kind=slip` (a viewer reports transfers with a slip). The type is
 * taken from the file's bytes, not the client's mime.
 */
export const uploadDocument: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const input = UploadDocumentInput.parse(req.body ?? {});
  if (me.role === "viewer" && input.kind !== "slip") throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  const file = req.file;
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
  await saveFile(doc.fileKey, file.buffer);
  await insertDocument(doc);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: _id, text: `อัปโหลดเอกสาร "${doc.name}"` });
  res.status(201).json(documentView(doc));
};

/** B13 GET /api/trips/:tripId/documents/:docId/url → { url, expiresAt } (expires in 5 minutes). */
export const getDocumentUrl: RequestHandler = async (req, res) => {
  const doc = await loadDocument(currentMember(req).tripId, param(req, "docId"));
  const { url, expiresAt } = signedFileUrl(doc._id);
  res.json({ url, expiresAt: expiresAt.toISOString() });
};

/** B14 DELETE /api/trips/:tripId/documents/:docId — owner or uploader; a slip in use → 409. */
export const removeDocument: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const doc = await loadDocument(me.tripId, param(req, "docId"));
  if (me.role !== "owner" && doc.uploadedBy !== me._id) throw new HttpError(403, "forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
  if (await isUsedAsSlip(me.tripId, doc._id)) {
    throw new HttpError(409, "document_in_use", "เอกสารนี้เป็นสลิปของรายการค่าใช้จ่ายหรือการโอน");
  }
  await deleteDocument(me.tripId, doc._id);
  await removeFile(doc.fileKey);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: null, text: `ลบเอกสาร "${doc.name}"` });
  res.status(204).end();
};

/** GET /api/files/:docId?exp&sig — public, but only with a valid unexpired signature. */
export const serveSignedFile: RequestHandler = async (req, res) => {
  const docId = param(req, "docId");
  const query = SignedFileQuery.safeParse(req.query);
  if (!query.success || !verifyFileSignature(docId, query.data.exp, query.data.sig)) {
    throw new HttpError(403, "invalid_signature", "ลิงก์หมดอายุหรือไม่ถูกต้อง");
  }
  const doc = await findDocumentById(docId);
  const bytes = doc ? await readStoredFile(doc.fileKey) : null;
  if (!doc || !bytes) throw notFound();
  res.set({
    "Content-Type": doc.mime,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    "Cache-Control": "private, no-store",
  });
  res.send(bytes);
};
