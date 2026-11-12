import type { ReactNode } from "react";

interface TabPageHeaderProps {
  /** Small line above the title, e.g. the trip name. */
  caption: string;
  title: string;
  /** Icon button(s) on the right. */
  action?: ReactNode;
  /** Extra rows under the title (day tabs, filters, summary cards). */
  children?: ReactNode;
}

/** Header of the Planner / Places / Expenses / Summary tabs: caption + 24px title. */
export function TabPageHeader({ caption, title, action, children }: TabPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] text-ink-muted">{caption}</span>
          <h1 className="m-0 font-display text-2xl font-semibold">{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}
