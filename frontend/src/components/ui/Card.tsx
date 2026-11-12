import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  /** White card on the grey background (default, radius 20). */
  surface: "rounded-card bg-surface text-ink",
  /** Dark trip header card (radius 24). */
  ink: "rounded-trip bg-ink text-surface",
  /** Soft teal summary card. */
  primary: "rounded-tile bg-primary-soft text-primary-ink-strong",
} as const;

const paddings = { none: "", sm: "p-3.5", md: "p-4", lg: "p-5" } as const;

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  tone?: keyof typeof tones;
  padding?: keyof typeof paddings;
  children: ReactNode;
}

export function Card({ as: Tag = "section", tone = "surface", padding = "md", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cn("flex flex-col", tones[tone], paddings[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Card heading row: title on the left, an optional action on the right. */
export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="m-0 font-display text-[17px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}
