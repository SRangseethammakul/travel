import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initFileStore, removeFiles, saveFile, signedFileUrl } from "./files.js";

const s3 = {
  driver: "s3",
  endpoint: "https://sgp1.digitaloceanspaces.com",
  region: "us-east-1",
  bucket: "trips",
  accessKeyId: "AKIATEST",
  secretAccessKey: "secret",
  urlSecret: "u".repeat(32),
  publicApiUrl: "http://localhost:3000",
} as const;
const target = { fileKey: "t1/places/p1/ph1", mime: "image/jpeg", local: { path: "/api/files/x", subject: "x" } };

afterEach(() => vi.restoreAllMocks());

describe("s3 driver", () => {
  it("presigns a GET on the Spaces endpoint that expires, with the response type fixed", async () => {
    initFileStore(s3);
    const { url, expiresAt } = await signedFileUrl(target, 10 * 60_000);
    const u = new URL(url);
    expect(u.host).toContain("digitaloceanspaces.com");
    expect(u.pathname).toContain("t1/places/p1/ph1");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(u.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(u.searchParams.get("response-content-type")).toBe("image/jpeg");
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("uploads with the content type and deletes in one batch, never throwing on a storage error", async () => {
    initFileStore(s3);
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation((async () => ({})) as never);
    await saveFile("a/b", Buffer.from("x"), "image/png");
    const put = send.mock.calls[0]![0] as PutObjectCommand;
    expect(put.input).toMatchObject({ Bucket: "trips", Key: "a/b", ContentType: "image/png" });

    await removeFiles(["a/b", "a/c"]);
    expect(send.mock.calls[1]![0].input).toMatchObject({ Bucket: "trips", Delete: { Objects: [{ Key: "a/b" }, { Key: "a/c" }] } });

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    send.mockRejectedValueOnce(new Error("down"));
    await expect(removeFiles(["a/b"])).resolves.toBeUndefined();
  });
});
