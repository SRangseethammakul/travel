"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/next-path";
import { ApiError, apiFetch } from "./http";
import { listUsers } from "./queries";
import { MOCK_USER_COOKIE, SESSION_COOKIE } from "./session";
import type { AuthProvider } from "./types";

/**
 * Development sign-in only (production Login links to /api/auth/{provider}).
 * Google signs in as the first Google User (Act), LINE as the first LINE User
 * (Mint), from the backend's dev User list (A17). Use the dev User switcher to
 * be someone else. Then go back to `next`.
 */
export async function signIn(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV !== "development") redirect("/login");
  const provider = String(formData.get("provider")) as AuthProvider;
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const user = (await listUsers()).find((u) => u.provider === provider);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const jar = await cookies();
  // The backend lets `session` win over `mock-user`, so drop any leftover session.
  jar.delete(SESSION_COOKIE);
  jar.set(MOCK_USER_COOKIE, user.id, { path: "/", sameSite: "lax", httpOnly: true });
  redirect(next);
}

/**
 * B42: the backend ends every session of this User. Its Set-Cookie never
 * reaches the browser (server-to-server), so the cookies are dropped here too —
 * even when the backend call fails, so the User is never stuck signed in.
 */
export async function signOut(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", allowSignedOut: true });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(MOCK_USER_COOKIE);
  redirect("/login");
}
