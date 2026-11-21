/**
 * Document writes used by the Server Actions (B12 upload, B14 delete) and
 * B13 signed URLs for pages. A plain server module, not `'use server'`: these are
 * helpers, not actions the browser may call.
 */
import { ApiError, apiFetch, tripPath } from "./http";
import { localizePhotoUrl } from "./place-photos";
import type { ID, TripDocument } from "./types";

/** The uploaded slip, or null when nothing was picked. */
export function slipFile(form: FormData | null | undefined): File | null {
  const file = form?.get("slip");
  return file instanceof File && file.size > 0 ? file : null;
}

/** B12 POST /api/trips/:tripId/documents with `kind=slip` → the new Document id. */
export async function uploadSlip(tripId: ID, file: File): Promise<ID> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name.slice(0, 120) || "สลิป");
  form.append("kind", "slip");
  const doc = await apiFetch<TripDocument>(`${tripPath(tripId)}/documents`, { method: "POST", form });
  return doc.id;
}

/** B12 without `kind`: a trip document (ticket, booking) — editor+ only, the backend decides. */
export async function uploadDocument(tripId: ID, file: File, name?: string): Promise<TripDocument> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", (name?.trim() || file.name).slice(0, 120) || "เอกสาร");
  return apiFetch<TripDocument>(`${tripPath(tripId)}/documents`, { method: "POST", form });
}

/** B14 DELETE — best effort: a failed clean-up must not hide the error the User needs to see. */
export async function deleteDocumentQuietly(tripId: ID, docId: ID): Promise<void> {
  try {
    await apiFetch<void>(`${tripPath(tripId)}/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
}

/**
 * B13 GET /api/trips/:tripId/documents/:docId/url → a short-lived signed link.
 * Local driver: returned as a path (`/api/files/…?exp&sig`) — Next rewrites `/api/*`
 * to the backend (docs/adr/0001). S3 driver: the presigned link is returned as is.
 * null when the Document is gone or the link cannot be made.
 */
export async function getDocumentUrl(tripId: ID, docId: ID): Promise<string | null> {
  try {
    const { url } = await apiFetch<{ url: string; expiresAt: string }>(
      `${tripPath(tripId)}/documents/${encodeURIComponent(docId)}/url`,
    );
    // Local driver → path on the web origin; a presigned S3 link stays absolute (another host).
    return localizePhotoUrl(url);
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}
