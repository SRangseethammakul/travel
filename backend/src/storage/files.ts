/**
 * dev file storage for Documents: files live under UPLOAD_DIR and are only opened through
 * expiring HMAC-signed URLs. Real object storage (S3 / R2 / GCS) is undecided.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface FileStoreSettings {
  dir: string;
  urlSecret: string;
  publicApiUrl: string;
}

let settings: FileStoreSettings | null = null;

export function initFileStore(s: FileStoreSettings): void {
  settings = { ...s, dir: path.resolve(s.dir) };
}

function store(): FileStoreSettings {
  if (!settings) throw new Error("File store not initialised — call initFileStore()");
  return settings;
}

/** Absolute path for a key, never outside the upload directory. */
function pathOf(fileKey: string): string {
  const { dir } = store();
  const full = path.resolve(dir, fileKey);
  if (!full.startsWith(dir + path.sep)) throw new Error(`invalid file key ${fileKey}`);
  return full;
}

export async function saveFile(fileKey: string, data: Buffer): Promise<void> {
  const full = pathOf(fileKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** File bytes, or null when the file is missing. */
export async function readStoredFile(fileKey: string): Promise<Buffer | null> {
  try {
    return await readFile(pathOf(fileKey));
  } catch {
    return null;
  }
}

export async function removeFile(fileKey: string): Promise<void> {
  await rm(pathOf(fileKey), { force: true });
}

/** How long a signed file URL stays valid. */
export const SIGNED_URL_TTL_MS = 5 * 60_000;

const signature = (docId: string, expiresAtMs: number) =>
  createHmac("sha256", store().urlSecret).update(`${docId}.${expiresAtMs}`).digest("base64url");

export function signedFileUrl(docId: string, now = Date.now()): { url: string; expiresAt: Date } {
  const exp = now + SIGNED_URL_TTL_MS;
  const url = `${store().publicApiUrl}/api/files/${encodeURIComponent(docId)}?exp=${exp}&sig=${signature(docId, exp)}`;
  return { url, expiresAt: new Date(exp) };
}

/** True when `sig` was made by us for this document and `exp` has not passed. */
export function verifyFileSignature(docId: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isSafeInteger(exp) || exp < now) return false;
  const expected = Buffer.from(signature(docId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
