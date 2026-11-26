"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FLASH_COOKIE, FLASH_EVENT, flashFromCookieString, type Flash } from "@/lib/flash";
import { Icon } from "./Icon";

/** Reads and clears the one-shot `flash` cookie a Server Action left behind. */
function takeFlash(): Flash | null {
  const found = flashFromCookieString(document.cookie);
  if (document.cookie.split(";").some((c) => c.trim().startsWith(`${FLASH_COOKIE}=`))) {
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }
  return found;
}

/**
 * The confirmation toast after a save / edit / delete. Mounted once in the root layout; shows
 * the message a Server Action left in the `flash` cookie as soon as the next page is there.
 */
export function FlashToast() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [flash, setFlash] = useState<Flash | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const check = useCallback(() => {
    const next = takeFlash();
    if (!next) return;
    clearTimeout(timer.current);
    setFlash(next);
    timer.current = setTimeout(() => setFlash(null), next.tone === "error" ? 8000 : 4000);
  }, []);

  // Every page change (the action redirected here) and every action that stayed on the page.
  useEffect(() => {
    const id = setTimeout(check, 0);
    return () => clearTimeout(id);
  }, [pathname, search, check]);
  useEffect(() => {
    window.addEventListener(FLASH_EVENT, check);
    return () => {
      window.removeEventListener(FLASH_EVENT, check);
      clearTimeout(timer.current);
    };
  }, [check]);

  if (!flash) return null;
  const isError = flash.tone === "error";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-app justify-center px-5">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={cn(
          "pointer-events-auto flex w-full animate-fade-in items-center gap-1 rounded-tile py-1 pr-1 pl-4 text-sm font-semibold text-surface shadow-lg",
          isError ? "bg-danger" : "bg-ink",
        )}
      >
        <span className="min-w-0 flex-1 py-2 break-words">{flash.message}</span>
        {flash.link ? (
          <Link href={flash.link.href} onClick={() => setFlash(null)} className="flex min-h-11 shrink-0 items-center px-2 font-semibold text-surface underline">
            {flash.link.label}
          </Link>
        ) : null}
        <button
          type="button"
          aria-label="ปิดข้อความ"
          onClick={() => setFlash(null)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-icon border-0 bg-transparent text-surface hover:bg-surface/15"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
