"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError, apiFetch } from "./http";
import type { ID, Member } from "./types";

export type JoinChoice = { claimMemberId: ID } | { displayName: string };
export type JoinResult = { error: string } | { pending: true };

/**
 * B10 POST /api/join/:token — Claim an Unclaimed Member or join under a new name.
 * Active → open the trip. With approval on the Member is `pending` and cannot
 * open the trip yet (A3 404s), so the page says so instead.
 */
export async function joinTrip(token: string, choice: JoinChoice): Promise<JoinResult> {
  const body =
    "claimMemberId" in choice
      ? { claimMemberId: String(choice.claimMemberId) }
      : { displayName: String(choice.displayName ?? "").trim().replace(/\s+/g, " ").slice(0, 50) };
  if ("displayName" in body && !body.displayName) return { error: "ใส่ชื่อที่ให้เพื่อนเห็น" };
  let res: { tripId: ID; member: Member; pending: boolean };
  try {
    res = await apiFetch(`/api/join/${encodeURIComponent(token)}`, { method: "POST", json: body });
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidatePath("/", "layout");
  if (res.pending) return { pending: true };
  redirect(`/trips/${encodeURIComponent(res.tripId)}`);
}
