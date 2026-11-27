"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "./http";

/**
 * POST /api/admin/users/:id/signout — ends every session of the User. Redirects back
 * with `?signedout=1` so the page can show the success banner; failures return the
 * backend's Thai message.
 */
export async function forceSignOut(userId: string): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/signout`, { method: "POST" });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${encodeURIComponent(userId)}?signedout=1`);
}
