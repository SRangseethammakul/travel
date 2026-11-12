import type { ReactNode } from "react";
import { IconLink } from "./IconButton";

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  href: string;
  /** `back` (ย้อนกลับ) for detail pages, `close` (ปิด) for forms. */
  kind?: "back" | "close";
  action?: ReactNode;
}

/** Header of full-screen pages outside the tabs. */
export function BackHeader({ title, subtitle, href, kind = "back", action }: BackHeaderProps) {
  return (
    <header className="flex items-center gap-2 px-3 pt-4 pb-2">
      <IconLink href={href} icon={kind} label={kind === "back" ? "ย้อนกลับ" : "ปิด"} variant="ghost" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="m-0 truncate font-display text-lg font-semibold">{title}</h1>
        {subtitle ? <span className="text-xs text-ink-muted">{subtitle}</span> : null}
      </div>
      {action}
    </header>
  );
}
