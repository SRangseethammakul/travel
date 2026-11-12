/**
 * `?next=` after sign-in. Only same-site paths are allowed ("/trips/x"), never
 * "//evil.com" or "https://…", so the login page cannot be used to redirect
 * people elsewhere. Pure; shared by proxy, Login page and the sign-in action.
 */
export const DEFAULT_NEXT = "/trips";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return DEFAULT_NEXT;
  return value;
}

/** Invite token from a `/join/<token>` path (with or without a query), else null. */
export function joinTokenFromPath(path: string): string | null {
  const m = /^\/join\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Token from whatever people paste: a full invite URL, a `/join/…` path, or the bare token. */
export function joinTokenFromInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(text, "http://local");
    const token = joinTokenFromPath(url.pathname);
    if (token) return token;
  } catch {
    // not a URL; fall through
  }
  return /^[A-Za-z0-9_-]{4,64}$/.test(text) ? text : null;
}
