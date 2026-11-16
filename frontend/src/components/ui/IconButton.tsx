import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { LinkPending } from "./LinkPending";

const variants = {
  outline: "border border-line bg-surface text-ink hover:bg-bg active:bg-line-soft",
  ghost: "border-0 bg-transparent text-ink hover:bg-line-soft active:bg-line",
  muted: "border-0 bg-transparent text-ink-muted hover:bg-line-soft hover:text-ink",
  primary: "border-0 bg-primary text-surface hover:bg-primary-hover hover:text-surface active:bg-primary-ink",
} as const;

interface CommonProps {
  icon: IconName;
  /** Thai label, read by screen readers (required: the button has no text). */
  label: string;
  variant?: keyof typeof variants;
  /** Small red count badge (e.g. unread activity). Include the count in `label` too. */
  badge?: number;
  className?: string;
}

const base =
  "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-icon transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

function Badge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[5px] -right-[5px] flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg bg-danger px-[5px] text-[11px] leading-none font-bold text-surface"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type IconButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label">;

export function IconButton({ icon, label, variant = "outline", badge, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={cn(base, variants[variant], className)} {...rest}>
      <Icon name={icon} />
      {badge ? <Badge count={badge} /> : null}
    </button>
  );
}

export function IconLink({ icon, label, variant = "outline", badge, className, href }: CommonProps & { href: string }) {
  return (
    <Link href={href} aria-label={label} className={cn(base, "has-[[data-link-pending]]:opacity-60", variants[variant], className)}>
      <Icon name={icon} />
      <LinkPending className="absolute" />
      {badge ? <Badge count={badge} /> : null}
    </Link>
  );
}
