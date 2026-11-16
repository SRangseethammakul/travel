/**
 * Place photo helpers for pages. A plain server module (not `'use server'`).
 */
import type { Place } from "./types";

/**
 * With the local storage driver the backend returns `${PUBLIC_API_URL}/api/files/…`.
 * Keep only path + query so the browser loads it from the web origin (Next rewrites
 * `/api/*` to the backend, docs/adr/0001) — same as Document links. A presigned
 * S3 link (another host, another path) is left as is.
 */
export function localizePhotoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/api/files/") ? `${parsed.pathname}${parsed.search}` : url;
  } catch {
    return url;
  }
}

/** The Place with every photo `url` made loadable from the browser. */
export function localizePlacePhotos(place: Place): Place {
  const photos = place.photos ?? [];
  return { ...place, photos: photos.map((p) => ({ ...p, url: localizePhotoUrl(p.url) })) };
}
