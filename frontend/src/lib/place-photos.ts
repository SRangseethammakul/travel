/** Place photos: limits, Thai error text, URL expiry. Pure. */
import type { PlacePhoto } from "@/lib/api/types";

export const MAX_PLACE_PHOTOS = 10;
/** Backend limit per file. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const ERROR_TEXT: Record<string, string> = {
  unsupported_file_type: "ไฟล์นี้ไม่รองรับ ใช้ได้เฉพาะรูป JPEG, PNG, WebP หรือ HEIC",
  file_required: "ไม่พบไฟล์ที่เลือก ลองเลือกรูปใหม่",
  file_too_large: "รูปใหญ่เกิน 10 MB ลองเลือกรูปที่เล็กกว่านี้",
  photo_limit: "สถานที่นี้มีรูปครบ 10 รูปแล้ว",
  forbidden: "คุณไม่มีสิทธิ์เพิ่มหรือลบรูปของสถานที่นี้",
  rate_limited: "อัปโหลดไฟล์บ่อยเกินไป ลองใหม่อีกครั้งในอีกสักครู่ (ไม่เกิน 15 นาที)",
  backend_unreachable: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่",
};

/** Thai text for a backend error code; falls back to the backend's own message. */
export function photoErrorMessage(code: string, fallback?: string): string {
  return ERROR_TEXT[code] ?? fallback ?? "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่";
}

/** How many more photos the Place can take, counting uploads already in flight. */
export function photoSlotsLeft(saved: number, inFlight: number): number {
  return Math.max(0, MAX_PLACE_PHOTOS - saved - inFlight);
}

/** Epoch ms of the soonest `urlExpiresAt` (null when no photos or none parse). */
export function earliestExpiry(photos: readonly Pick<PlacePhoto, "urlExpiresAt">[]): number | null {
  const times = photos.map((p) => Date.parse(p.urlExpiresAt)).filter((t) => Number.isFinite(t));
  return times.length ? Math.min(...times) : null;
}

/** Refresh this long before the links expire so nobody sees a broken image. */
export const REFRESH_MARGIN_MS = 60_000;

/** Milliseconds until the Place should be re-fetched for fresh links (0 = now). null = nothing to refresh. */
export function refreshDelay(photos: readonly Pick<PlacePhoto, "urlExpiresAt">[], now: number): number | null {
  const at = earliestExpiry(photos);
  return at === null ? null : Math.max(0, at - REFRESH_MARGIN_MS - now);
}

/** Minimal shape of a `ClipboardItem` (async Clipboard API), so this stays testable without a DOM. */
export interface ClipboardItemLike {
  readonly types: readonly string[];
  getType(type: string): Promise<Blob>;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/gif": "gif" };

/**
 * Image files from `navigator.clipboard.read()`: one per clipboard item, using its first image type
 * (iOS often offers both PNG and JPEG for one copied photo). Items with no image are skipped.
 */
export async function clipboardImageFiles(items: readonly ClipboardItemLike[], now = Date.now()): Promise<File[]> {
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(new File([blob], `pasted-${now}-${files.length + 1}.${EXT[type] ?? "img"}`, { type }));
  }
  return files;
}

/** Image files from a `paste` event's `clipboardData.files` (keyboard paste / iOS "Paste" in a text field). */
export function pastedImageFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}
