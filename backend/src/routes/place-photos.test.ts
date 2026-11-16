/** Place photos: upload, signed URLs, 10-photo cap, delete permissions, cleanup. */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { collections } from "../db/collections.js";
import { MAX_UPLOAD_BYTES } from "../schemas/document.inputs.js";
import type { PlacePhotoDoc } from "../schemas/models.js";
import { readStoredFile } from "../storage/files.js";
import { as, testConfig, useTestDb } from "../test/helpers.js";

const t = useTestDb();
const app = () => createApp(testConfig);
const T = "tokyo-winter";
const P = "t-sensoji";
const photosUrl = (place = P) => `/api/trips/${T}/places/${place}/photos`;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1");
const HEIC = Buffer.from("\0\0\0\x18ftypheic\0\0\0\0", "latin1");
const PDF = Buffer.from("%PDF-1.7\n%test\n");

const upload = (user: string, file: Buffer, place = P) => request(app()).post(photosUrl(place)).set(as(user)).attach("file", file, "photo.jpg");
const stored = async (place = P) => (await collections.places().findOne({ _id: place }))?.photos ?? [];
const lastActivity = () => collections.activities().find({ tripId: T }).sort({ createdAt: -1 }).limit(1).next();

beforeEach(async () => {
  await t.reseed();
  await collections.members().insertOne({
    _id: `${T}:n`, tripId: T, userId: "n", displayName: "N", role: "viewer", status: "active", color: "slate", createdAt: new Date(),
  });
});

describe("POST photos", () => {
  it("editor uploads a JPEG: 201 with the photo view, no fileKey, activity added", async () => {
    const res = await upload("mint", JPEG);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      mime: "image/jpeg",
      size: JPEG.length,
      uploadedBy: `${T}:mint`,
      createdAt: expect.any(String),
      url: expect.stringContaining("/api/files/places/t-sensoji/photos/"),
      urlExpiresAt: expect.any(String),
    });
    expect((await stored()).map((p) => p._id)).toEqual([res.body.id]);
    expect((await stored())[0]!.fileKey).toBe(`${T}/places/${P}/${res.body.id}`);
    expect(await lastActivity()).toMatchObject({ type: "plan", refId: P, text: 'เพิ่มรูป "' + (await collections.places().findOne({ _id: P }))!.name + '"' });
  });

  it("accepts PNG, WebP and HEIC; the type comes from the bytes", async () => {
    for (const [file, mime] of [[PNG, "image/png"], [WEBP, "image/webp"], [HEIC, "image/heic"]] as const) {
      const res = await upload("act", file);
      expect(res.status).toBe(201);
      expect(res.body.mime).toBe(mime);
    }
  });

  it("rejects a PDF, text and a missing file with 400 (Thai message)", async () => {
    for (const file of [PDF, Buffer.from("<html>")]) {
      const res = await upload("mint", file);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("unsupported_file_type");
    }
    const none = await request(app()).post(photosUrl()).set(as("mint")).field("x", "y");
    expect(none.status).toBe(400);
    expect(await stored()).toHaveLength(0);
  });

  it("rejects a file over 10 MB with 413", async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    const res = await upload("mint", big);
    expect(res.status).toBe(413);
    expect(await stored()).toHaveLength(0);
  });

  it("the 11th photo is 409 and leaves no file behind", async () => {
    const photos: PlacePhotoDoc[] = Array.from({ length: 10 }, (_, i) => ({
      _id: `ph${i}`, fileKey: `${T}/places/${P}/ph${i}`, mime: "image/jpeg", size: 1, uploadedBy: `${T}:act`, createdAt: new Date(),
    }));
    await collections.places().updateOne({ _id: P }, { $set: { photos } });
    const res = await upload("mint", JPEG);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("photo_limit");
    expect(await stored()).toHaveLength(10);
  });

  it("the cap holds when uploads race", async () => {
    const results = await Promise.all(Array.from({ length: 13 }, () => upload("mint", JPEG)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(10);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await stored()).toHaveLength(10);
  });

  it("a viewer is 403, a non-Member is 404, an unknown Place is 404", async () => {
    expect((await upload("n", JPEG)).status).toBe(403);
    expect((await request(app()).post("/api/trips/khao-yai/places/x/photos").set(as("n")).attach("file", JPEG, "a.jpg")).status).toBe(404);
    expect((await upload("mint", JPEG, "nope")).status).toBe(404);
    expect(await stored()).toHaveLength(0);
  });
});

describe("photos in Place views and signed URLs", () => {
  it("list, one, group and patch responses carry photos with URLs; no fileKey anywhere", async () => {
    const up = await upload("mint", JPEG);
    const list = await request(app()).get(`/api/trips/${T}/places`).set(as("n"));
    const place = list.body.find((p: { id: string }) => p.id === P);
    expect(place.photos).toEqual([{ ...up.body, url: expect.stringContaining(`/photos/${up.body.id}?exp=`), urlExpiresAt: expect.any(String) }]);
    expect(list.body.find((p: { id: string }) => p.id !== P).photos).toEqual([]);

    const one = await request(app()).get(`/api/trips/${T}/places/${P}`).set(as("n"));
    expect(one.body.photos).toHaveLength(1);
    expect(one.body.photos[0].url).toContain("/api/files/places/");

    const groups = await request(app()).get(`/api/trips/${T}/places?group=area`).set(as("n"));
    const grouped = groups.body.flatMap((g: { places: { id: string; photos: unknown[] }[] }) => g.places).find((p: { id: string }) => p.id === P);
    expect(grouped.photos).toHaveLength(1);

    const patch = await request(app()).patch(`/api/trips/${T}/places/${P}`).set(as("act")).send({ note: "x" });
    expect(patch.body.photos).toHaveLength(1);
    expect(JSON.stringify([list.body, one.body, groups.body, patch.body])).not.toContain("fileKey");

    const created = await request(app()).post(`/api/trips/${T}/places`).set(as("mint")).send({ name: "ใหม่", type: "sight", city: "Tokyo", area: null });
    expect(created.body.photos).toEqual([]);
  });

  it("the signed URL serves the bytes; a tampered, expired or wrong-photo signature is 403", async () => {
    const a = await upload("mint", JPEG);
    const b = await upload("mint", PNG);
    const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;
    const file = await request(app()).get(pathOf(a.body.url)).responseType("blob");
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/jpeg");
    expect(Buffer.isBuffer(file.body) && file.body.equals(JPEG)).toBe(true);
    expect(Date.parse(a.body.urlExpiresAt) - Date.now()).toBeGreaterThan(10 * 60_000);

    expect((await request(app()).get(pathOf(a.body.url).replace(/sig=[^&]+/, "sig=bad"))).status).toBe(403);
    expect((await request(app()).get(pathOf(a.body.url).replace(/exp=\d+/, "exp=1"))).status).toBe(403);
    // a signature made for photo A does not open photo B
    const swapped = pathOf(b.body.url).replace(/sig=[^&]+/, `sig=${new URL(a.body.url).searchParams.get("sig")}`);
    expect((await request(app()).get(swapped)).status).toBe(403);
  });

  it("existing Document URLs still work (signed by document id)", async () => {
    const signed = await request(app()).get(`/api/trips/${T}/documents/doc-flight/url`).set(as("act"));
    expect(signed.status).toBe(200);
    expect(signed.body.url).toContain("/api/files/doc-flight?exp=");
  });
});

describe("DELETE photo", () => {
  it("uploader or owner may delete; another editor and a viewer may not", async () => {
    const mine = await upload("mint", JPEG);
    const url = (id: string) => `${photosUrl()}/${id}`;
    const key = (await stored())[0]!.fileKey;
    expect(await readStoredFile(key)).not.toBeNull();

    expect((await request(app()).delete(url(mine.body.id)).set(as("beam"))).status).toBe(403);
    expect((await request(app()).delete(url(mine.body.id)).set(as("n"))).status).toBe(403);
    expect(await stored()).toHaveLength(1);

    expect((await request(app()).delete(url(mine.body.id)).set(as("mint"))).status).toBe(204);
    expect(await stored()).toHaveLength(0);
    expect(await readStoredFile(key)).toBeNull();
    expect(await lastActivity()).toMatchObject({ refId: P, text: expect.stringContaining("ลบรูป") });

    const other = await upload("mint", PNG);
    expect((await request(app()).delete(url(other.body.id)).set(as("act"))).status).toBe(204);
    expect((await request(app()).delete(url(other.body.id)).set(as("act"))).status).toBe(404);
    expect((await request(app()).delete(`/api/trips/khao-yai/places/${P}/photos/x`).set(as("act"))).status).toBe(404);
  });
});

describe("cleanup", () => {
  it("deleting a Place removes its photo files", async () => {
    const res = await upload("mint", JPEG, "t-skytree");
    expect(res.status).toBe(201);
    const key = (await stored("t-skytree"))[0]!.fileKey;
    expect(await readStoredFile(key)).not.toBeNull();
    const del = await request(app()).delete(`/api/trips/${T}/places/t-skytree`).set(as("act"));
    expect(del.status).toBe(204);
    expect(await readStoredFile(key)).toBeNull();
  });

  it("deleting a Trip removes photo and document files", async () => {
    await upload("mint", JPEG);
    await upload("act", PNG, "t-skytree");
    const keys = [...(await stored()), ...(await stored("t-skytree"))].map((p) => p.fileKey);
    const docKey = (await collections.documents().findOne({ tripId: T }))!.fileKey;
    const { saveFile } = await import("../storage/files.js");
    await saveFile(docKey, PDF, "application/pdf");
    for (const k of [...keys, docKey]) expect(await readStoredFile(k)).not.toBeNull();

    expect((await request(app()).delete(`/api/trips/${T}`).set(as("act"))).status).toBe(204);
    for (const k of [...keys, docKey]) expect(await readStoredFile(k)).toBeNull();
  });
});
