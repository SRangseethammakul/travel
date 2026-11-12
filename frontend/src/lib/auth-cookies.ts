/**
 * Cookie names shared by proxy.ts and lib/api (no imports, so the proxy stays light).
 * - `session`: set by the backend after LINE / Google sign-in (signed, httpOnly).
 * - `mock-user`: development only, holds a **User** id (`act`, `mint`, …). The
 *   backend lets `session` win when both are present.
 */
export const SESSION_COOKIE = "session";
export const MOCK_USER_COOKIE = "mock-user";

/** Request header proxy.ts sets to the current path + query, for `/login?next=`. */
export const PATHNAME_HEADER = "x-pathname";
