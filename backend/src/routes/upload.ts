import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../errors.js";
import { MAX_UPLOAD_BYTES } from "../schemas/document.inputs.js";

const multerSingle = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single("file");

/** multer (one `file` field, in memory) with its errors turned into the API error shape. */
export const singleFile: RequestHandler = (req, res, next) => {
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
