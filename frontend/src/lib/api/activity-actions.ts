"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import type { ID } from "./types";

/** B39 — mark Activity read for the current User. No ids = "อ่านทั้งหมดแล้ว". */
export async function markRead(tripId: ID, activityIds?: ID[]): Promise<ActionResult> {
  const ids = Array.isArray(activityIds) ? activityIds.filter((x) => typeof x === "string").slice(0, 200) : undefined;
  if (ids && ids.length === 0) return null;
  try {
    await apiFetch<void>(`${tripPath(tripId)}/activity/read`, { method: "POST", json: ids ? { ids } : {} });
  } catch (e) {
    return { error: actionError(e).error };
  }
  // Activity page and the bell badge on the trip page.
  revalidatePath(`/trips/${encodeURIComponent(tripId)}`, "layout");
  return null;
}
