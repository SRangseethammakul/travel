import { Router } from "express";
import { getDocument, getDocumentUrl, getDocuments, removeDocument, serveSignedFile, uploadDocument } from "../controllers/document.controller.js";
import { servePlacePhoto } from "../controllers/place-photo.controller.js";
import { userLimiter } from "./rate-limit.js";
import { singleFile } from "./upload.js";

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
fileRoutes.get("/places/:placeId/photos/:photoId", servePlacePhoto);
fileRoutes.get("/:docId", serveSignedFile);
