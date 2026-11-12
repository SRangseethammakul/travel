/**
 * QA phase 5 — real login (API.md B40–B43, A1, A17). Sources: first-backend.md "ผู้ใช้และการเข้าสู่ระบบ"
 * (session cookie httpOnly/secure/sameSite=lax, mock-user off in production), SPEC "เข้าสู่ระบบด้วย LINE
 * หรือ Google" (ชื่อ อีเมล รูป only). Gaps beyond phase5.test.ts: LINE, re-login, races, expiry, production.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collections } from "../db/collections.js";
import { as } from "../test/helpers.js";
import { cookiePair, fakeProviderFetch, p45App, setCookies, startLogin, useP45Db } from "./p45-helpers.js";
import { expectError } from "./qa-helpers.js";

const t = useP45Db("auth");
const creds = { GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret", LINE_CHANNEL_ID: "lid", LINE_CHANNEL_SECRET: "lsecret" };
const oauthApp = () => p45App(creds);
const prodApp = () => p45App({ ...creds, NODE_ENV: "production" });

/** Full login: start → provider (faked) → callback. Returns the callback response and the session cookie. */
async function login(provider: "google" | "line", profile: Record<string, unknown>, app = oauthApp(), next?: string) {
  const { state, stateCookie } = await startLogin(app, provider, next);
  vi.stubGlobal("fetch", vi.fn(fakeProviderFetch(profile)));
  const cb = await request(app).get(`/api/auth/${provider}/callback?state=${state}&code=abc`).set("Cookie", stateCookie);
  const session = setCookies(cb).find((c) => c.startsWith("session="));
  return { cb, session, sessionPair: session ? cookiePair(session) : undefined };
}

beforeEach(() => t.reseed());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LINE login (B40, B41)", () => {
  it("redirects to access.line.me asking only for profile, openid, email", async () => {
    const { res } = await startLogin(oauthApp(), "line");
    const url = new URL(res.headers.location!);
    expect(url.origin).toBe("https://access.line.me");
    expect(url.searchParams.get("scope")!.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4000/api/auth/line/callback");
    expect(url.searchParams.get("state")!.length).toBeGreaterThanOrEqual(16);
  });

  it("callback creates a LINE User (name, email, picture), sets the session, GET /api/me works", async () => {
    const { cb, sessionPair } = await login("line", { sub: "U-line-1", name: "Fah", email: "fah@example.com", picture: "https://profile.line-scdn.net/fah" });
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("http://localhost:3000/trips");
    const me = await request(oauthApp()).get("/api/me").set("Cookie", sessionPair!);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: "Fah", email: "fah@example.com", avatarUrl: "https://profile.line-scdn.net/fah", provider: "line" });
    expect(Object.keys(me.body).sort()).toEqual(["avatarUrl", "color", "email", "id", "name", "provider"]);
  });

  it("LINE without an email still signs in (email is optional on LINE)", async () => {
    const { cb, sessionPair } = await login("line", { sub: "U-line-2", name: "NoMail" });
    expect(cb.status).toBe(302);
    const me = await request(oauthApp()).get("/api/me").set("Cookie", sessionPair!);
    expect(me.status).toBe(200);
    expect(me.body.provider).toBe("line");
  });

  it("a new User has no trips yet", async () => {
    const { sessionPair } = await login("line", { sub: "U-line-3", name: "New" });
    const trips = await request(oauthApp()).get("/api/trips").set("Cookie", sessionPair!);
    expect(trips.status).toBe(200);
    expect(trips.body).toEqual([]);
  });
});

describe("find or create (B41)", () => {
  it("logging in again with the same subject reuses the User and refreshes name/email", async () => {
    const first = await login("google", { sub: "g-re", name: "Old", email: "old@example.com" });
    const second = await login("google", { sub: "g-re", name: "New Name", email: "new@example.com" });
    expect(await collections.users().countDocuments({ provider: "google", providerSubject: "g-re" })).toBe(1);
    const me1 = await request(oauthApp()).get("/api/me").set("Cookie", first.sessionPair!);
    const me2 = await request(oauthApp()).get("/api/me").set("Cookie", second.sessionPair!);
    expect(me1.body.id).toBe(me2.body.id);
    expect(me2.body).toMatchObject({ name: "New Name", email: "new@example.com" });
  });

  it("the same subject on LINE and Google are two different Users", async () => {
    await login("google", { sub: "same-sub", name: "G" });
    await login("line", { sub: "same-sub", name: "L" });
    expect(await collections.users().countDocuments({ providerSubject: "same-sub" })).toBe(2);
  });

  it("two first logins at the same time → one User, both get a session", async () => {
    const app = oauthApp();
    const [a, b] = await Promise.all([startLogin(app, "google"), startLogin(app, "google")]);
    vi.stubGlobal("fetch", vi.fn(fakeProviderFetch({ sub: "g-race", name: "Race" })));
    const [ra, rb] = await Promise.all([
      request(app).get(`/api/auth/google/callback?state=${a.state}&code=1`).set("Cookie", a.stateCookie),
      request(app).get(`/api/auth/google/callback?state=${b.state}&code=2`).set("Cookie", b.stateCookie),
    ]);
    expect([ra.status, rb.status]).toEqual([302, 302]);
    expect(await collections.users().countDocuments({ providerSubject: "g-race" })).toBe(1);
  });

  it("the provider's token endpoint failing → 502 with the error shape, no session", async () => {
    const app = oauthApp();
    const { state, stateCookie } = await startLogin(app, "google");
    vi.stubGlobal("fetch", vi.fn(fakeProviderFetch({}, { failToken: true })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cb = await request(app).get(`/api/auth/google/callback?state=${state}&code=abc`).set("Cookie", stateCookie);
    expectError(cb, 502);
    expect(setCookies(cb).some((c) => c.startsWith("session=") && !c.startsWith("session=;"))).toBe(false);
  });

  it("the user cancels at the provider (no code) → back to /login?error=cancelled, no User created", async () => {
    const app = oauthApp();
    const before = await collections.users().countDocuments();
    const { state, stateCookie } = await startLogin(app, "google");
    const cb = await request(app).get(`/api/auth/google/callback?state=${state}&error=access_denied`).set("Cookie", stateCookie);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("http://localhost:3000/login?error=cancelled");
    expect(await collections.users().countDocuments()).toBe(before);
  });

  it("callback without the state cookie → 400 with a Thai message", async () => {
    const { state } = await startLogin(oauthApp(), "google");
    expectError(await request(oauthApp()).get(`/api/auth/google/callback?state=${state}&code=abc`), 400);
  });

  it("a state cookie from LINE cannot finish a Google login with a different state", async () => {
    const app = oauthApp();
    const line = await startLogin(app, "line");
    const google = await startLogin(app, "google");
    expectError(await request(app).get(`/api/auth/google/callback?state=${google.state}&code=abc`).set("Cookie", line.stateCookie), 400);
  });

  it("unknown provider callback → 404", async () => {
    expectError(await request(oauthApp()).get("/api/auth/github/callback?state=x&code=y"), 404);
  });
});

describe("next= is kept but only for same-site paths", () => {
  const cases: [string, string][] = [
    ["/trips/tokyo-winter", "http://localhost:3000/trips/tokyo-winter"],
    ["/\\evil.example", "http://localhost:3000/trips"],
    ["https://evil.example/x", "http://localhost:3000/trips"],
    ["//evil.example", "http://localhost:3000/trips"],
  ];
  for (const [next, expected] of cases) {
    it(`next=${next} → ${expected}`, async () => {
      const { cb } = await login("google", { sub: `g-next-${next}`, name: "N" }, oauthApp(), next);
      expect(cb.headers.location).toBe(expected);
    });
  }
});

describe("session cookie", () => {
  it("dev: HttpOnly, SameSite=Lax, Path=/; production: also Secure", async () => {
    const dev = await login("google", { sub: "g-c1", name: "C" });
    expect(dev.session).toMatch(/HttpOnly/i);
    expect(dev.session).toMatch(/SameSite=Lax/i);
    expect(dev.session).toMatch(/Path=\//);
    const prod = await login("google", { sub: "g-c2", name: "C" }, prodApp());
    expect(prod.session).toMatch(/Secure/i);
    expect(prod.session).toMatch(/HttpOnly/i);
  });

  it("works in production (the real sign-in path)", async () => {
    const app = prodApp();
    const { sessionPair } = await login("google", { sub: "g-prod", name: "Prod" }, app);
    const me = await request(app).get("/api/me").set("Cookie", sessionPair!);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe("Prod");
  });

  it("a tampered session cookie → 401", async () => {
    const { sessionPair } = await login("google", { sub: "g-t", name: "T" });
    // Swap the User id inside the signed value: the signature no longer matches.
    const forged = sessionPair!.replace(/session=s%3A[^.]+/, "session=s%3Aact");
    expectError(await request(oauthApp()).get("/api/me").set("Cookie", forged), 401);
    expectError(await request(oauthApp()).get("/api/me").set("Cookie", "session=act.99999999999999"), 401);
  });

  it("a session older than its lifetime (30 days) → 401", async () => {
    const { sessionPair } = await login("google", { sub: "g-old", name: "Old" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    expectError(await request(oauthApp()).get("/api/me").set("Cookie", sessionPair!), 401);
  });

  it("logout answers 204 and tells the browser to drop the cookie", async () => {
    const { sessionPair } = await login("google", { sub: "g-out", name: "Out" });
    const out = await request(oauthApp()).post("/api/auth/logout").set("Cookie", sessionPair!);
    expect(out.status).toBe(204);
    const cleared = setCookies(out).find((c) => c.startsWith("session="))!;
    expect(cleared).toMatch(/^session=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("session of a signed-in User gives access to their trips like mock-user does", async () => {
    // Sign in as a new User, then link them to Tokyo as Act would by inviting: use the join flow.
    const { sessionPair } = await login("google", { sub: "g-join", name: "Joiner" });
    const join = await request(oauthApp()).post("/api/join/tokyo-winter-7d-seed-invite").set("Cookie", sessionPair!).send({ displayName: "Joiner" });
    expect(join.status).toBe(200);
    expect(join.body.pending).toBe(true);
    // Pending until approved → still 404 for the trip.
    expectError(await request(oauthApp()).get("/api/trips/tokyo-winter").set("Cookie", sessionPair!), 404);
  });
});

describe("production switches off dev helpers (first-backend.md: ปิด mock-user เด็ดขาด)", () => {
  it("GET /api/dev/users → 404", async () => {
    expectError(await request(prodApp()).get("/api/dev/users"), 404);
  });

  it("POST /api/dev/login → 404 and no mock-user cookie", async () => {
    const res = await request(prodApp()).post("/api/dev/login").send({ userId: "act" });
    expectError(res, 404);
    expect(setCookies(res).some((c) => c.startsWith("mock-user="))).toBe(false);
  });

  it("mock-user is ignored on trip routes too → 401", async () => {
    expectError(await request(prodApp()).get("/api/trips/tokyo-winter").set(as("act")), 401);
    expectError(await request(prodApp()).get("/api/trips/tokyo-winter/balances").set(as("act")), 401);
  });
});

describe("security headers", () => {
  it("auth and upload routes carry helmet headers", async () => {
    for (const res of [
      await request(oauthApp()).get("/api/auth/google"),
      await request(oauthApp()).get("/api/trips/tokyo-winter/documents").set(as("act")),
    ]) {
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
      expect(res.headers["x-powered-by"]).toBeUndefined();
    }
  });

  it("CORS allows only the frontend origin, with credentials", async () => {
    const ok = await request(oauthApp()).get("/api/health").set("Origin", "http://localhost:3000");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(ok.headers["access-control-allow-credentials"]).toBe("true");
    const evil = await request(oauthApp()).get("/api/health").set("Origin", "https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
  });
});
