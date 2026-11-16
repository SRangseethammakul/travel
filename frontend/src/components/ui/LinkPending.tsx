"use client";

import { useLinkStatus } from "next/link";

/**
 * Put inside a `<Link>` so a tap responds at once. Marks the link as pending and
 * shows a small spinner; style the link with `has-[[data-link-pending]]:opacity-60`.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      data-link-pending=""
      role="status"
      aria-label="กำลังโหลด"
      className={`inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
