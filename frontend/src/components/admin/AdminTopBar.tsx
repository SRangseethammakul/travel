import Link from "next/link";
import type { ReactNode } from "react";

/** Page header: optional breadcrumb, title, count, env badge, and right-hand controls. */
export function AdminTopBar({
  title,
  count,
  back,
  children,
}: {
  title: string;
  count?: string;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  const env = process.env.NODE_ENV === "production" ? "production" : "development";
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-line bg-surface px-8">
      {back ? (
        <>
          <Link href={back.href} className="text-sm text-ink-subtle no-underline hover:text-ink">
            {back.label}
          </Link>
          <span aria-hidden="true" className="-mx-2 text-disabled">
            /
          </span>
        </>
      ) : null}
      <h1 className="m-0 font-display text-[22px] font-semibold">{title}</h1>
      {count ? <span className="text-sm text-ink-muted">{count}</span> : null}
      <span className="rounded-full bg-todo-soft px-2.5 py-[3px] text-xs font-semibold text-todo">{env}</span>
      <div className="flex-1" />
      {children}
    </header>
  );
}
