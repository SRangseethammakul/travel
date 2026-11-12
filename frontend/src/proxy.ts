import { NextResponse, type NextRequest } from "next/server";
import { MOCK_USER_COOKIE, PATHNAME_HEADER, SESSION_COOKIE } from "@/lib/auth-cookies";

/**
 * First gate only: no `session` cookie (or, in development, `mock-user`) →
 * /login?next=<where they were going>. Login and invite links stay public (SPEC
 * flow: JoinTrip → Login). Whether the cookie is valid and the User may see a
 * trip is decided by the backend (401 → /login, 404 → /trips in lib/api/http.ts).
 */
const PUBLIC_PREFIXES = ["/login", "/join/"];

function signedIn(request: NextRequest): boolean {
  if (request.cookies.has(SESSION_COOKIE)) return true;
  return process.env.NODE_ENV === "development" && request.cookies.has(MOCK_USER_COOKIE);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));

  if (isPublic || signedIn(request)) {
    // Tell lib/api which page is rendering, so a 401 can send the User back here after sign-in.
    const headers = new Headers(request.headers);
    headers.set(PATHNAME_HEADER, `${pathname}${search}`);
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip /api (rewritten to the backend, which checks auth itself — OAuth start
  // and callback must stay reachable signed out), Next internals, the dev
  // component page and any file with an extension (favicon, images).
  matcher: ["/((?!api/|_next/static|_next/image|dev/|.*\\.[\\w]+$).*)"],
};
