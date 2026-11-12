/** Phase 5: checklist, documents, OAuth login + session. */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const T = "tokyo-winter";
const PDF = Buffer.from("%PDF-1.7\n%test\n");
/** supertest types `set-cookie` loosely; it is always a list. */
const setCookies = (res: { headers: Record<string, unknown> }) => (res.headers["set-cookie"] ?? []) as string[];

beforeEach(async () => {
  await t.reseed();
  // N joins Tokyo as a viewer for role tests.
  await collections.members().insertOne({
    _id: `${T}:n`, tripId: T, userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

describe("checklist", () => {
  it("returns group items + only my personal items (filtered in the query)", async () => {
    const act = await request(app()).get(`/api/trips/${T}/checklist`).set(as("act"));
    const mint = await request(app()).get(`/api/trips/${T}/checklist`).set(as("mint"));
    const personal = (body: { scope: string }[]) => body.filter((c) => c.scope === "personal").length;
    expect(personal(act.body)).toBe(6);
    expect(personal(mint.body)).toBe(0);
    expect(act.body.length - 6).toBe(mint.body.length);
  });

  it("personal: any Member adds their own; another Member's personal item is 404", async () => {
    const res = await request(app()).post(`/api/trips/${T}/checklist`).set(as("n")).send({ scope: "personal", text: "หมวก", category: "เสื้อผ้า" });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(`${T}:n`);
    expect((await request(app()).patch(`/api/trips/${T}/checklist/${res.body.id}`).set(as("act")).send({ done: true })).status).toBe(404);
    expect((await request(app()).delete(`/api/trips/${T}/checklist/${res.body.id}`).set(as("act"))).status).toBe(404);
  });

  it("group: viewer can tick (doneBy set by server) but not add, edit text or delete", async () => {
    expect((await request(app()).post(`/api/trips/${T}/checklist`).set(as("n")).send({ scope: "group", text: "x", category: "y" })).status).toBe(403);
    const tick = await request(app()).patch(`/api/trips/${T}/checklist/c-3`).set(as("n")).send({ done: true });
    expect(tick.body).toMatchObject({ done: true, doneBy: `${T}:n` });
    expect((await request(app()).patch(`/api/trips/${T}/checklist/c-3`).set(as("n")).send({ text: "x" })).status).toBe(403);
    expect((await request(app()).delete(`/api/trips/${T}/checklist/c-3`).set(as("n"))).status).toBe(403);
    const untick = await request(app()).patch(`/api/trips/${T}/checklist/c-3`).set(as("mint")).send({ done: false, assigneeId: null });
    expect(untick.body.doneBy).toBeUndefined();
    expect(untick.body.assigneeId).toBeUndefined();
    expect((await request(app()).delete(`/api/trips/${T}/checklist/c-3`).set(as("mint"))).status).toBe(204);
  });

  it("group changes add an Activity; non-members get 404", async () => {
    const before = await collections.activities().countDocuments({ tripId: T });
    await request(app()).post(`/api/trips/${T}/checklist`).set(as("mint")).send({ scope: "group", text: "แลกเงิน", category: "เพิ่มเอง" });
    expect(await collections.activities().countDocuments({ tripId: T })).toBe(before + 1);
    expect((await request(app()).get("/api/trips/khao-yai/checklist").set(as("n"))).status).toBe(404);
  });

  it("suggestions", async () => {
    const res = await request(app()).get("/api/checklist/suggestions?scope=group").set(as("act"));
    expect(res.body.length).toBeGreaterThan(0);
    expect((await request(app()).get("/api/checklist/suggestions?scope=x").set(as("act"))).status).toBe(400);
  });
});

describe("documents", () => {
  const upload = (user: string, file: Buffer, fields: Record<string, string> = {}) => {
    let req = request(app()).post(`/api/trips/${T}/documents`).set(as(user)).attach("file", file, "file.pdf");
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req;
  };

  it("editor uploads a PDF; the type comes from the bytes; no fileKey in the response", async () => {
    const res = await upload("mint", PDF, { name: "ใบจองรถ" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "ใบจองรถ", mime: "application/pdf", size: PDF.length, uploadedBy: `${T}:mint` });
    expect(res.body.fileKey).toBeUndefined();
    expect((await upload("mint", Buffer.from("<html>"), { name: "x" })).status).toBe(400);
  });

  it("viewer may upload only a slip", async () => {
    expect((await upload("n", PDF, { name: "x" })).status).toBe(403);
    expect((await upload("n", PDF, { kind: "slip" })).status).toBe(201);
  });

  it("signed URL opens the file; a tampered or expired one is 403", async () => {
    const doc = await upload("mint", PDF, { name: "ตั๋ว" });
    const signed = await request(app()).get(`/api/trips/${T}/documents/${doc.body.id}/url`).set(as("n"));
    const path = new URL(signed.body.url).pathname + new URL(signed.body.url).search;
    const file = await request(app()).get(path).responseType("blob"); // body is a Buffer
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.isBuffer(file.body) && file.body.equals(PDF)).toBe(true);
    expect((await request(app()).get(path.replace(/sig=[^&]+/, "sig=bad"))).status).toBe(403);
    expect((await request(app()).get(path.replace(/exp=\d+/, "exp=1"))).status).toBe(403);
    expect((await request(app()).get(`/api/trips/khao-yai/documents/${doc.body.id}/url`).set(as("act"))).status).toBe(404);
  });

  it("delete: owner or uploader only; a slip in use → 409", async () => {
    const doc = await upload("mint", PDF, { name: "x" });
    expect((await request(app()).delete(`/api/trips/${T}/documents/${doc.body.id}`).set(as("beam"))).status).toBe(403);
    expect((await request(app()).delete(`/api/trips/${T}/documents/${doc.body.id}`).set(as("mint"))).status).toBe(204);

    const slip = await upload("ploy", PDF, { kind: "slip" });
    await collections.settlements().updateOne({ _id: "s-beam" }, { $set: { slipDocId: slip.body.id } });
    expect((await request(app()).delete(`/api/trips/${T}/documents/${slip.body.id}`).set(as("act"))).status).toBe(409);
  });

  it("deleting a document unlinks it from Transit items", async () => {
    expect((await request(app()).delete(`/api/trips/${T}/documents/doc-flight`).set(as("act"))).status).toBe(204);
    expect(await collections.planItems().countDocuments({ tripId: T, docIds: "doc-flight" })).toBe(0);
  });
});

describe("OAuth login", () => {
  const config = { ...testConfig, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret" };
  const oauthApp = () => createApp(config);
  afterEach(() => vi.unstubAllGlobals());

  it("a provider without credentials is 404", async () => {
    expect((await request(app()).get("/api/auth/line")).status).toBe(404);
    expect((await request(app()).get("/api/auth/github")).status).toBe(404);
  });

  it("redirects to Google, then creates the User and sets a session cookie", async () => {
    const start = await request(oauthApp()).get("/api/auth/google?next=/trips/tokyo-winter");
    expect(start.status).toBe(302);
    const location = new URL(start.headers.location!);
    expect(location.origin).toBe("https://accounts.google.com");
    const state = location.searchParams.get("state")!;
    const stateCookie = setCookies(start)[0]!.split(";")[0]!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(
          url.includes("token")
            ? { access_token: "at" }
            : { sub: "google-123", name: "Ice", email: "ice@example.com", picture: "https://example.com/ice.png" },
        ),
      ),
    );
    const cb = await request(oauthApp()).get(`/api/auth/google/callback?state=${state}&code=abc`).set("Cookie", stateCookie);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe("http://localhost:3000/trips/tokyo-winter");
    const session = setCookies(cb).find((c: string) => c.startsWith("session="))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);

    const me = await request(oauthApp()).get("/api/me").set("Cookie", session.split(";")[0]!);
    expect(me.body).toMatchObject({ name: "Ice", email: "ice@example.com", provider: "google" });
    expect(await collections.users().countDocuments({ providerSubject: "google-123" })).toBe(1);
  });

  it("a wrong state is refused; next can't redirect off-site", async () => {
    const res = await request(oauthApp()).get("/api/auth/google/callback?state=x&code=abc");
    expect(res.status).toBe(400);
    const start = await request(oauthApp()).get("/api/auth/google?next=//evil.example");
    const cookie = decodeURIComponent(setCookies(start)[0]!);
    expect(cookie).toContain("|/trips");
  });

  it("logout clears the session", async () => {
    const res = await request(app()).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(setCookies(res)[0]).toMatch(/^session=;/);
  });

  describe("logout ends the session on the server (sessionVersion)", () => {
    async function googleLogin(sub: string, appFor = oauthApp()) {
      const start = await request(appFor).get("/api/auth/google");
      const state = new URL(start.headers.location!).searchParams.get("state")!;
      vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("token") ? { access_token: "at" } : { sub, name: sub })));
      const cb = await request(appFor).get(`/api/auth/google/callback?state=${state}&code=abc`).set("Cookie", setCookies(start)[0]!.split(";")[0]!);
      return setCookies(cb).find((c: string) => c.startsWith("session="))!.split(";")[0]!;
    }

    it("a session cookie copied before logout → 401 after logout", async () => {
      const copied = await googleLogin("g-logout");
      expect((await request(oauthApp()).get("/api/me").set("Cookie", copied)).status).toBe(200);
      expect((await request(oauthApp()).post("/api/auth/logout").set("Cookie", copied)).status).toBe(204);
      const after = await request(oauthApp()).get("/api/me").set("Cookie", copied);
      expect(after.status).toBe(401);
      expect(after.body.error.code).toBe("unauthenticated");
    });

    it("same in production (no mock-user fallback)", async () => {
      const prod = createApp({ ...config, NODE_ENV: "production" });
      const copied = await googleLogin("g-logout-prod", prod);
      expect((await request(prod).get("/api/me").set("Cookie", copied)).status).toBe(200);
      expect((await request(prod).post("/api/auth/logout").set("Cookie", copied)).status).toBe(204);
      expect((await request(prod).get("/api/me").set("Cookie", copied)).status).toBe(401);
    });

    it("signing in again after logout gives a new working session; the old one stays dead", async () => {
      const old = await googleLogin("g-again");
      await request(oauthApp()).post("/api/auth/logout").set("Cookie", old);
      const fresh = await googleLogin("g-again");
      expect((await request(oauthApp()).get("/api/me").set("Cookie", fresh)).status).toBe(200);
      expect((await request(oauthApp()).get("/api/me").set("Cookie", old)).status).toBe(401);
    });

    it("dev mock-user still works, also after logging out with it", async () => {
      expect((await request(app()).post("/api/auth/logout").set(as("act"))).status).toBe(204);
      expect((await request(app()).get("/api/me").set(as("act"))).body.id).toBe("act");
      expect((await request(app()).get(`/api/trips/${T}`).set(as("act"))).status).toBe(200);
    });

    it("sessionVersion is never sent to the client", async () => {
      const cookie = await googleLogin("g-private");
      await collections.users().updateOne({ providerSubject: "g-private" }, { $set: { sessionVersion: 0 } });
      const me = await request(oauthApp()).get("/api/me").set("Cookie", cookie);
      expect(me.body.sessionVersion).toBeUndefined();
    });
  });

  it("mock-user is ignored in production", async () => {
    const prod = createApp({ ...testConfig, NODE_ENV: "production" });
    expect((await request(prod).get("/api/me").set(as("act"))).status).toBe(401);
  });
});

describe("security headers", () => {
  it("are set on every response", async () => {
    const res = await request(app()).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
