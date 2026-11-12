import { Router, type RequestHandler } from "express";
import multer from "multer";
import { getDocument, getDocumentUrl, getDocuments, removeDocument, serveSignedFile, uploadDocument } from "../controllers/document.controller.js";
import { HttpError } from "../errors.js";
import { MAX_UPLOAD_BYTES } from "../schemas/document.inputs.js";
import { userLimiter } from "./rate-limit.js";

const multerSingle = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single("file");

/** multer with its errors turned into the API error shape. */
const singleFile: RequestHandler = (req, res, next) => {
  multerSingle(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        err.code === "LIMIT_FILE_SIZE"
          ? new HttpError(413, "file_too_large", "ไฟล์ใหญ่เกิน 10 MB")
          : new HttpError(400, "invalid_upload", "อัปโหลดไฟล์ไม่สำเร็จ"),
      );
      return;
    }
    next(err);
  });
};

/** Per User (not IP): this router is mounted behind `requireUser` in app.ts — keep it that way. */
const uploadLimiter = userLimiter();

/** Mounted at /api/trips/:tripId/documents behind requireUser + requireMember. Roles are checked in the controller. */
export const documentRoutes = Router();
documentRoutes.get("/", getDocuments);
documentRoutes.post("/", uploadLimiter, singleFile, uploadDocument);
documentRoutes.get("/:docId", getDocument);
documentRoutes.get("/:docId/url", getDocumentUrl);
documentRoutes.delete("/:docId", removeDocument);

/** Mounted at /api/files — signed URLs only, no session needed. */
export const fileRoutes = Router();
fileRoutes.get("/:docId", serveSignedFile);
