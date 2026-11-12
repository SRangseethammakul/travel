"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Horizontal scroller (day tabs on long trips) that brings the current item
 * (`aria-current`) into view, so `?day=7` never opens with its tab hidden.
 */
export function ScrollStrip({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = ref.current;
    const current = strip?.querySelector<HTMLElement>("[aria-current]");
    if (!strip || !current) return;
    const target = current.offsetLeft - strip.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "instant" });
  });
  return (
    <div ref={ref} className={cn("-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]", className)}>
      {children}
    </div>
  );
}
