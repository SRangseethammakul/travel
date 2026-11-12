/**
 * The one way lib/api talks to the backend (docs/adr/0001): server-side fetch to
 * BACKEND_URL with the browser's cookies forwarded and no caching (every answer
 * depends on who is signed in).
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/lib/auth-cookies";
import { safeNextPath } from "@/lib/next-path";
import { BACKEND_URL } from "./backend-url";

/** A backend error `{ error: { code, message } }`; `message` is Thai and safe to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as multipart (file uploads). */
  form?: FormData;
  /**
   * 401 normally redirects to `/login?next=<current page>`. Set this on reads that
   * must work signed out (Login, JoinTrip, the dev User switcher, logout): the
   * 401 is then thrown as an ApiError instead.
   */
  allowSignedOut?: boolean;
  /**
   * `trip_not_found` (not a Member, or no such trip) normally redirects to
   * `/trips`. Set this to get the ApiError instead (e.g. getCurrentMember → null).
   */
  allowTripNotFound?: boolean;
}

/** Cookie header from the current request, including cookies set or deleted earlier in this Server Action. */
async function cookieHeader(): Promise<string> {
  return (await cookies())
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

/** Where to come back to after sign-in: the page being rendered (set by proxy.ts). */
async function currentPath(): Promise<string> {
  return safeNextPath((await headers()).get(PATHNAME_HEADER));
}

async function readError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return new ApiError(
    res.status,
    typeof err?.code === "string" ? err.code : "http_error",
    typeof err?.message === "string" ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่",
  );
}

/**
 * Calls `BACKEND_URL + path` (path starts with `/api/`). Returns the parsed JSON,
 * or `undefined` for 204. Errors become ApiError, except 401 → /login and
 * `trip_not_found` → /trips (see options).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", json, form, allowSignedOut = false, allowTripNotFound = false } = options;
  const reqHeaders: Record<string, string> = { accept: "application/json" };
  const cookie = await cookieHeader();
  if (cookie) reqHeaders.cookie = cookie;
  let body: BodyInit | undefined;
  if (form) body = form;
  else if (json !== undefined) {
    reqHeaders["content-type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, { method, headers: reqHeaders, body, cache: "no-store" });
  } catch {
    throw new ApiError(503, "backend_unreachable", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  const error = await readError(res);
  if (error.status === 401 && !allowSignedOut) {
    redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
  }
  if (error.status === 404 && error.code === "trip_not_found" && !allowTripNotFound) {
    redirect("/trips");
  }
  throw error;
}

/** A single-resource read: 404 (no such Expense / Document / Place) → null. */
export async function nullOn404<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Backend path of a trip: `/api/trips/:tripId`. */
export const tripPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}`;

/**
 * For Server Actions: an ApiError becomes `{ error }` with the backend's Thai
 * message for the form to show; anything else (including redirect()) is rethrown.
 * `rate_limited` on an upload gets a message that says what to do.
 */
export function actionError(e: unknown): { error: string; code: string } {
  if (!(e instanceof ApiError)) throw e;
  if (e.code === "rate_limited") {
    return { error: "อัปโหลดไฟล์บ่อยเกินไป ลองใหม่อีกครั้งในอีกสักครู่ (ไม่เกิน 15 นาที)", code: e.code };
  }
  return { error: e.message, code: e.code };
}
