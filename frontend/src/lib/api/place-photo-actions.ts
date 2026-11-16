"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import type { ID, PlacePhoto } from "./types";

/** `null` = done. `code` is the backend error code (see lib/place-photos.ts for the Thai text). */
export type PlacePhotoUploadResult = { error: string; code: string } | null;

const photosPath = (tripId: ID, placeId: ID) => `${tripPath(tripId)}/places/${encodeURIComponent(placeId)}/photos`;

/** B15a — one photo per call (multipart field `file`, already resized in the browser). Owner / editor only; the backend decides. */
export async function uploadPlacePhotoAction(tripId: ID, placeId: ID, form: FormData): Promise<PlacePhotoUploadResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "ไม่พบไฟล์ที่เลือก ลองเลือกรูปใหม่", code: "file_required" };
  const body = new FormData();
  body.append("file", file, file.name);
  try {
    await apiFetch<PlacePhoto>(photosPath(tripId, placeId), { method: "POST", form: body });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath(`/trips/${encodeURIComponent(tripId)}`, "layout");
  return null;
}

/** B15b — owner or the uploader (else 403 with a Thai message). */
export async function deletePlacePhotoAction(tripId: ID, placeId: ID, photoId: ID): Promise<ActionResult> {
  try {
    await apiFetch<void>(`${photosPath(tripId, placeId)}/${encodeURIComponent(photoId)}`, { method: "DELETE" });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidatePath(`/trips/${encodeURIComponent(tripId)}`, "layout");
  return null;
}
