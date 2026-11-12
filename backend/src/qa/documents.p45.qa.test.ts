/**
 * QA phase 5 — Documents (API.md A6, B12–B14, signed file URLs). Sources: SPEC โมเดลข้อมูล
 * ("Document … เก็บ private เปิดด้วย signed URL"), first-backend.md "เอกสาร" and ช่วง 5.
 * Gaps beyond phase5.test.ts. Keep this file under 30 uploads: the upload rate limiter is
 * module-level and shared by every app instance in the file (429 is tested in ratelimit.p45).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { as } from "../test/helpers.js";
import { JPEG, p45App, PDF, PNG, upload, useP45Db } from "./p45-helpers.js";
import { activityCount, addN, expectError, expectIdNotUnderscore, J, mid, setMember, T } from "./qa-helpers.js";

const t = useP45Db("documents");
const app = () => p45App();
const M = (k: string) => mid(T, k);
const api = `/api/trips/${T}/documents`;
/** Path + query of a signed URL, for supertest. */
const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

async function signedUrl(docId: string, user = "mint") {
  const res = await request(app()).get(`${api}/${docId}/url`).set(as(user));
  expect(res.status).toBe(200);
  return res.body as { url: string; expiresAt: string };
}

beforeEach(() => t.reseed());
afterEach(() => {
  vi.useRealTimers();
});

describe("access", () => {
  it("no User → 401 on list / upload / url / delete", async () => {
    expectError(await request(app()).get(api), 401);
    expectError(await request(app()).post(api).attach("file", PDF, "a.pdf"), 401);
    expectError(await request(app()).get(`${api}/doc-flight/url`), 401);
    expectError(await request(app()).delete(`${api}/doc-flight`), 401);
  });

  it("non-Member and pending Member → 404 on list / one / url / delete", async () => {
    // "beam" is not in Japan; "n" is pending in Tokyo.
    await addN("editor", "pending");
    for (const [user, tripApi] of [["n", api], ["beam", `/api/trips/${J}/documents`]] as const) {
      expectError(await request(app()).get(tripApi).set(as(user)), 404);
      expectError(await request(app()).get(`${tripApi}/doc-flight`).set(as(user)), 404);
      expectError(await request(app()).get(`${tripApi}/doc-flight/url`).set(as(user)), 404);
      expectError(await request(app()).delete(`${tripApi}/doc-flight`).set(as(user)), 404);
    }
  });

  it("a Document of another trip is 404 through this trip's path", async () => {
    // Act is a Member of Japan; doc-flight belongs to Tokyo.
    expectError(await request(app()).get(`/api/trips/${J}/documents/doc-flight`).set(as("act")), 404);
    expectError(await request(app()).delete(`/api/trips/${J}/documents/doc-flight`).set(as("act")), 404);
  });
});

describe("list / one (A6) — no file location leaks", () => {
  it("TripDocument[] with id, tripId, name, mime, size, uploadedBy; no fileKey, no URL", async () => {
    const res = await request(app()).get(api).set(as("ploy"));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const d of res.body) {
      expectIdNotUnderscore(d);
      expect(d).toMatchObject({ tripId: T, name: expect.any(String), mime: expect.any(String), size: expect.any(Number), uploadedBy: expect.any(String) });
      expect(d).not.toHaveProperty("fileKey");
      expect(JSON.stringify(d)).not.toMatch(/https?:\/\/|sig=/);
    }
    const one = await request(app()).get(`${api}/doc-hotel`).set(as("ploy"));
    expect(one.status).toBe(200);
    expect(one.body).not.toHaveProperty("fileKey");
  });
});

describe("upload (B12)", () => {
  it("type comes from the bytes: PNG named .pdf with a pdf content-type is stored as image/png", async () => {
    let req = request(app()).post(api).set(as("mint")).field("name", "รูป");
    req = req.attach("file", PNG, { filename: "fake.pdf", contentType: "application/pdf" });
    const res = await req;
    expect(res.status).toBe(201);
    expect(res.body.mime).toBe("image/png");
  });

  it("JPEG → image/jpeg; size is the byte count", async () => {
    const res = await upload(app(), T, "mint", JPEG, { name: "รูปตั๋ว" }, "x.jpg");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mime: "image/jpeg", size: JPEG.length, uploadedBy: M("mint"), tripId: T });
  });

  it("no file → 400 with a Thai message", async () => {
    expectError(await upload(app(), T, "mint", null, { name: "ไม่มีไฟล์" }), 400);
  });

  it("file over 10 MB → rejected with the error shape (413)", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    expectError(await upload(app(), T, "mint", big, { name: "ใหญ่" }), 413);
  });

  it("unknown kind / name over 200 chars → 400", async () => {
    expectError(await upload(app(), T, "mint", PDF, { kind: "receipt" }), 400);
    expectError(await upload(app(), T, "mint", PDF, { name: "ก".repeat(201) }), 400);
  });

  it("upload adds an Activity; a rejected upload does not", async () => {
    const before = await activityCount(T);
    await upload(app(), T, "mint", Buffer.from("plain text"), { name: "x" });
    expect(await activityCount(T)).toBe(before);
    await upload(app(), T, "mint", PDF, { name: "ใบจองรถ" });
    expect(await activityCount(T)).toBe(before + 1);
  });
});

describe("signed URL (B13) — expiring, private", () => {
  it("any Member (viewer too) gets { url, expiresAt } a few minutes ahead; the file opens without a cookie", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const doc = await upload(app(), T, "mint", PDF, { name: "ตั๋ว" });
    const before = Date.now();
    const s = await signedUrl(doc.body.id, "ploy");
    const exp = Date.parse(s.expiresAt);
    expect(exp).toBeGreaterThan(before + 60_000);
    expect(exp).toBeLessThanOrEqual(before + 60 * 60_000);
    expect(new URL(s.url).pathname).toBe(`/api/files/${doc.body.id}`);
    const file = await request(app()).get(pathOf(s.url)).responseType("blob");
    expect(file.status).toBe(200);
    expect(file.headers["cache-control"]).toMatch(/no-store/);
    expect(Buffer.isBuffer(file.body) && file.body.equals(PDF)).toBe(true);
  });

  it("the same URL stops working once it has expired → 403", async () => {
    const doc = await upload(app(), T, "mint", PDF, { name: "หมดอายุ" });
    const s = await signedUrl(doc.body.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(s.expiresAt) + 1_000);
    expectError(await request(app()).get(pathOf(s.url)), 403);
  });

  it("a signature made for one Document does not open another → 403", async () => {
    const a = await upload(app(), T, "mint", PDF, { name: "A" });
    const b = await upload(app(), T, "mint", PNG, { name: "B" });
    const s = await signedUrl(a.body.id);
    expectError(await request(app()).get(pathOf(s.url).replace(a.body.id, b.body.id)), 403);
  });

  it("missing sig or exp → 403", async () => {
    const doc = await upload(app(), T, "mint", PDF, { name: "C" });
    const s = await signedUrl(doc.body.id);
    const u = new URL(s.url);
    expectError(await request(app()).get(`${u.pathname}?exp=${u.searchParams.get("exp")}`), 403);
    expectError(await request(app()).get(`${u.pathname}?sig=${u.searchParams.get("sig")}`), 403);
    expectError(await request(app()).get(u.pathname), 403);
  });

  it("after the Document is deleted, a URL signed earlier → 404", async () => {
    const doc = await upload(app(), T, "mint", PDF, { name: "ลบแล้ว" });
    const s = await signedUrl(doc.body.id);
    expect((await request(app()).delete(`${api}/${doc.body.id}`).set(as("mint"))).status).toBe(204);
    expectError(await request(app()).get(pathOf(s.url)), 404);
  });
});

describe("delete (B14) — owner or uploader", () => {
  it("editor who did not upload → 403; owner → 204; second delete → 404", async () => {
    const doc = await upload(app(), T, "mint", PDF, { name: "ของมิ้นท์" });
    expectError(await request(app()).delete(`${api}/${doc.body.id}`).set(as("ploy")), 403);
    const before = await activityCount(T);
    expect((await request(app()).delete(`${api}/${doc.body.id}`).set(as("act"))).status).toBe(204);
    expect(await activityCount(T)).toBe(before + 1);
    expectError(await request(app()).delete(`${api}/${doc.body.id}`).set(as("act")), 404);
  });

  it("viewer deletes the slip they uploaded → 204", async () => {
    await setMember(M("ploy"), { role: "viewer" });
    const slip = await upload(app(), T, "ploy", PDF, { kind: "slip" });
    expect((await request(app()).delete(`${api}/${slip.body.id}`).set(as("ploy"))).status).toBe(204);
  });

  it("a slip used by an Expense → 409, Expense keeps its slip", async () => {
    const slip = await upload(app(), T, "mint", PDF, { kind: "slip" });
    const e = await request(app()).post(`/api/trips/${T}/expenses`).set(as("mint")).send({
      title: "ค่าแท็กซี่", category: "transport", payerId: M("mint"), method: "promptpay", slipDocId: slip.body.id,
      amount: 6_000, splitMode: "equal", shares: [{ memberId: M("mint") }, { memberId: M("act") }], date: "2026-12-14",
    });
    expect(e.status).toBe(201);
    expectError(await request(app()).delete(`${api}/${slip.body.id}`).set(as("act")), 409);
    expect((await request(app()).get(`/api/trips/${T}/expenses/${e.body.id}`).set(as("act"))).body.slipDocId).toBe(slip.body.id);
  });
});
