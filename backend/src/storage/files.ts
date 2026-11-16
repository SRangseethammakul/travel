/**
 * File storage for Documents and Place photos. Two drivers behind the same functions:
 * `local` (disk under UPLOAD_DIR, opened through our own HMAC-signed /api/files routes — dev and
 * tests) and `s3` (private DigitalOcean Spaces bucket, opened through presigned GET URLs).
 * Files are never public: every read goes through an expiring signed URL.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface CommonSettings {
  urlSecret: string;
  publicApiUrl: string;
}
type FileStoreSettings = CommonSettings &
  (
    | { driver: "local"; dir: string }
    | { driver: "s3"; endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }
  );

type Store =
  | (CommonSettings & { driver: "local"; dir: string })
  | (CommonSettings & { driver: "s3"; bucket: string; client: S3Client });

let settings: Store | null = null;

export function initFileStore(s: FileStoreSettings): void {
  if (s.driver === "local") {
    settings = { ...s, dir: path.resolve(s.dir) };
    return;
  }
  const client = new S3Client({
    endpoint: s.endpoint,
    region: s.region,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
  });
  settings = { driver: "s3", urlSecret: s.urlSecret, publicApiUrl: s.publicApiUrl, bucket: s.bucket, client };
}

function store(): Store {
  if (!settings) throw new Error("File store not initialised — call initFileStore()");
  return settings;
}

/** Absolute path for a key, never outside the upload directory (local driver). */
function pathOf(dir: string, fileKey: string): string {
  const full = path.resolve(dir, fileKey);
  if (!full.startsWith(dir + path.sep)) throw new Error(`invalid file key ${fileKey}`);
  return full;
}

export async function saveFile(fileKey: string, data: Buffer, mime: string): Promise<void> {
  const s = store();
  if (s.driver === "s3") {
    await s.client.send(new PutObjectCommand({ Bucket: s.bucket, Key: fileKey, Body: data, ContentType: mime }));
    return;
  }
  const full = pathOf(s.dir, fileKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** File bytes served by our own /api/files routes (local driver only); null when missing or the driver is s3. */
export async function readStoredFile(fileKey: string): Promise<Buffer | null> {
  const s = store();
  if (s.driver !== "local") return null;
  try {
    return await readFile(pathOf(s.dir, fileKey));
  } catch {
    return null;
  }
}

/**
 * Deletes files; a missing file is not an error. Called after the database change has been made,
 * so a storage failure is logged rather than turned into an error response (it leaves an orphan).
 */
export async function removeFiles(fileKeys: string[]): Promise<void> {
  if (!fileKeys.length) return;
  const s = store();
  if (s.driver === "local") {
    await Promise.all(fileKeys.map((key) => rm(pathOf(s.dir, key), { force: true })));
    return;
  }
  for (let i = 0; i < fileKeys.length; i += 1000) {
    const batch = fileKeys.slice(i, i + 1000);
    try {
      await s.client.send(new DeleteObjectsCommand({ Bucket: s.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
    } catch (err) {
      console.error("failed to delete files from object storage", batch.length, err);
    }
  }
}

/** How long a signed file URL stays valid. */
export const SIGNED_URL_TTL_MS = 5 * 60_000;

/** Photos sit in lists that stay open longer, so their URLs live longer. */
export const PHOTO_URL_TTL_MS = 15 * 60_000;

const signature = (subject: string, expiresAtMs: number) =>
  createHmac("sha256", store().urlSecret).update(`${subject}.${expiresAtMs}`).digest("base64url");

/** What a signed URL points at. `local` says how our own route finds it (path + what the signature covers). */
export interface SignedTarget {
  fileKey: string;
  mime: string;
  /** Download name for the Content-Disposition header. */
  filename?: string;
  local: { path: string; subject: string };
}

export async function signedFileUrl(
  target: SignedTarget,
  ttlMs = SIGNED_URL_TTL_MS,
  now = Date.now(),
): Promise<{ url: string; expiresAt: Date }> {
  const s = store();
  const exp = now + ttlMs;
  if (s.driver === "s3") {
    const command = new GetObjectCommand({
      Bucket: s.bucket,
      Key: target.fileKey,
      ResponseContentType: target.mime,
      ...(target.filename ? { ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(target.filename)}` } : {}),
    });
    return { url: await getSignedUrl(s.client, command, { expiresIn: Math.round(ttlMs / 1000) }), expiresAt: new Date(exp) };
  }
  const { path: route, subject } = target.local;
  return { url: `${s.publicApiUrl}${route}?exp=${exp}&sig=${signature(subject, exp)}`, expiresAt: new Date(exp) };
}

/** True when `sig` was made by us for this subject and `exp` has not passed. */
export function verifyFileSignature(subject: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isSafeInteger(exp) || exp < now) return false;
  const expected = Buffer.from(signature(subject, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
