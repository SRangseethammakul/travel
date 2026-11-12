import { z } from "zod";

/** 10 MB per file (the validator allows up to 20 MB; final limit still open). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Form fields sent with the file (multipart). `kind: 'slip'` lets any Member upload a transfer slip. */
export const UploadDocumentInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(["slip"]).optional(),
});

export const SignedFileQuery = z.object({
  exp: z.coerce.number().int(),
  sig: z.string().min(1).max(100),
});
