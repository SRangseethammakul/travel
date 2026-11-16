/**
 * Client-side photo resize before upload: longest side to ~1600px, re-encoded as
 * JPEG. Decoding also turns iPhone HEIC into JPEG (Safari can decode HEIC). If the
 * browser cannot decode the file the original is uploaded as it is.
 * The browser parts are injected (`ResizeDeps`) so the logic is testable in node.
 */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.82;

export interface Size {
  width: number;
  height: number;
}

/** Scale so the longest side is at most `max`; never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): Size {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** `IMG_0012.HEIC` → `IMG_0012.jpg` */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "photo"}.jpg`;
}

export interface ResizeDeps {
  /** Decode to pixels (EXIF rotation applied). Throws when the browser cannot read the file. */
  decode: (file: File) => Promise<{ width: number; height: number; close?: () => void; source: unknown }>;
  /** Draw `decoded.source` at `size` on a white background and encode as JPEG. Resolves null if encoding fails. */
  encode: (decoded: { source: unknown }, size: Size, quality: number) => Promise<Blob | null>;
  makeFile: (blob: Blob, name: string, lastModified: number) => File;
}

/**
 * The file to upload: a resized JPEG, or the original when it cannot be decoded /
 * encoded, or when re-encoding would not make an already small JPEG smaller.
 */
export async function prepareImageForUpload(file: File, deps: ResizeDeps, max = MAX_SIDE, quality = JPEG_QUALITY): Promise<File> {
  let decoded;
  try {
    decoded = await deps.decode(file);
  } catch {
    return file;
  }
  try {
    const size = fitWithin(decoded.width, decoded.height, max);
    const blob = await deps.encode(decoded, size, quality);
    if (!blob || blob.size === 0) return file;
    const resized = size.width !== decoded.width || size.height !== decoded.height;
    if (!resized && file.type === "image/jpeg" && blob.size >= file.size) return file;
    return deps.makeFile(blob, jpegName(file.name), file.lastModified);
  } catch {
    return file;
  } finally {
    decoded.close?.();
  }
}

/** Real browser deps: createImageBitmap + canvas. */
export const browserResizeDeps: ResizeDeps = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
  },
  async encode(decoded, size, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG has no alpha: PNG / WebP with transparency would turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source as ImageBitmap, 0, 0, size.width, size.height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  },
  makeFile: (blob, name, lastModified) => new File([blob], name, { type: "image/jpeg", lastModified }),
};

export const prepareImage = (file: File) => prepareImageForUpload(file, browserResizeDeps);
