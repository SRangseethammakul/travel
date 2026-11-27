import type { RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { SignedFileQuery, UploadDocumentInput } from "../schemas/document.inputs.js";
import * as documents from "../services/document.service.js";
import { documentView } from "../views/document.view.js";
import { param } from "./params.js";

/** A6 GET /api/trips/:tripId/documents (no file URLs). */
export const getDocuments: RequestHandler = async (req, res) => {
  res.json((await documents.list(currentMember(req).tripId)).map(documentView));
};

/** GET /api/trips/:tripId/documents/:docId (frontend `getDocument`). */
export const getDocument: RequestHandler = async (req, res) => {
  res.json(documentView(await documents.get(currentMember(req).tripId, param(req, "docId"))));
};

/** B12 POST /api/trips/:tripId/documents (multipart `file` + `name`). */
export const uploadDocument: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const input = UploadDocumentInput.parse(req.body ?? {});
  res.status(201).json(documentView(await documents.upload(me, input, req.file ?? null)));
};

/** B13 GET /api/trips/:tripId/documents/:docId/url → { url, expiresAt } (expires in 5 minutes). */
export const getDocumentUrl: RequestHandler = async (req, res) => {
  const { url, expiresAt } = await documents.signedUrl(currentMember(req).tripId, param(req, "docId"));
  res.json({ url, expiresAt: expiresAt.toISOString() });
};

/** B14 DELETE /api/trips/:tripId/documents/:docId — owner or uploader; a slip in use → 409. */
export const removeDocument: RequestHandler = async (req, res) => {
  await documents.remove(currentMember(req), param(req, "docId"));
  res.status(204).end();
};

/** GET /api/files/:docId?exp&sig — public, but only with a valid unexpired signature. */
export const serveSignedFile: RequestHandler = async (req, res) => {
  const query = SignedFileQuery.safeParse(req.query);
  const { doc, bytes } = await documents.serve(param(req, "docId"), query.success ? query.data : null);
  res.set({
    "Content-Type": doc.mime,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    "Cache-Control": "private, no-store",
  });
  res.send(bytes);
};
