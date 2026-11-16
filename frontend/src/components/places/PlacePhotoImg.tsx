"use client";

import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PlacePhoto } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** Signed links last ~15 minutes; do not re-fetch the page more often than this when one fails. */
const REFRESH_COOLDOWN_MS = 30_000;
let lastRefreshAt = 0;

/** Re-fetch the page (its Places come back with fresh signed links). Throttled; false when it was skipped. */
export function requestFreshPhotoLinks(router: { refresh: () => void }): boolean {
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) return false;
  lastRefreshAt = now;
  startTransition(() => router.refresh());
  return true;
}

interface PlacePhotoImgProps {
  photo: Pick<PlacePhoto, "id" | "url">;
  alt: string;
  /** Classes for the <img> (sizing / object-fit). */
  className?: string;
  /** What to show when the image cannot be opened even with a fresh link (e.g. HEIC on a browser that cannot decode it). */
  brokenLabel?: string;
}

/**
 * A signed-URL photo. A plain <img> on purpose: the link carries its own expiry
 * and signature, which next/image would cache and re-sign. On a load error the
 * page is refreshed once for new links; if it still fails a placeholder shows.
 */
export function PlacePhotoImg({ photo, alt, className, brokenLabel }: PlacePhotoImgProps) {
  const router = useRouter();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const triedRefresh = useRef<string | null>(null);

  if (failedUrl === photo.url) {
    return (
      <span role="img" aria-label={alt} className={cn("flex flex-col items-center justify-center gap-1 bg-line-soft p-1 text-center text-ink-muted", className)}>
        <Icon name="image" size={20} aria-hidden="true" />
        {brokenLabel ? <span className="text-xs">{brokenLabel}</span> : null}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      onError={() => {
        if (triedRefresh.current !== photo.url) {
          triedRefresh.current = photo.url;
          if (requestFreshPhotoLinks(router)) return;
        }
        setFailedUrl(photo.url);
      }}
    />
  );
}
