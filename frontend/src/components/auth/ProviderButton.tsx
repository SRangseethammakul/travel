"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

const marks = {
  line: { letter: "L", label: "LINE", className: "bg-primary-soft text-primary-ink" },
  google: { letter: "G", label: "Google", className: "bg-interest-soft text-interest-ink" },
} as const;

type Provider = keyof typeof marks;

const shell = cn(
  "flex h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-ink bg-surface px-4 text-base font-semibold text-ink no-underline transition-colors duration-150",
  "hover:bg-bg hover:text-ink active:bg-line-soft",
);

function Content({ provider, busy }: { provider: Provider; busy: boolean }) {
  const m = marks[provider];
  return (
    <>
      <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold", m.className)}>
        {m.letter}
      </span>
      <span className="mr-7 flex-1 text-center">{busy ? "กำลังเข้าสู่ระบบ…" : `ดำเนินการต่อด้วย ${m.label}`}</span>
    </>
  );
}

/**
 * "ดำเนินการต่อด้วย LINE / Google". Neutral style from the mockup; the real
 * buttons must follow each provider's brand guideline.
 * - With `href` (production): a plain link to the backend's OAuth start
 *   (`/api/auth/{provider}`, rewritten by Next) — not next/link, it is not a page.
 * - Without (development): a submit button for the mock sign-in form.
 */
export function ProviderButton({ provider, href }: { provider: Provider; href?: string }) {
  const { pending, data } = useFormStatus();
  if (href) {
    return (
      <a href={href} className={shell}>
        <Content provider={provider} busy={false} />
      </a>
    );
  }
  const mine = pending && data?.get("provider") === provider;
  return (
    <button
      type="submit"
      name="provider"
      value={provider}
      disabled={pending}
      aria-busy={mine || undefined}
      className={cn(shell, "disabled:cursor-wait disabled:opacity-70")}
    >
      <Content provider={provider} busy={mine} />
    </button>
  );
}
