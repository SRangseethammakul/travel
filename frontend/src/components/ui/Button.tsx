import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  /** Main action: teal fill. Disabled = grey fill (AddExpense save button). */
  primary:
    "border-0 bg-primary text-surface hover:bg-primary-hover active:bg-primary-ink disabled:bg-disabled disabled:hover:bg-disabled",
  /** Secondary in a pair (sheet cancel). */
  secondary: "border border-line-strong bg-surface text-ink hover:bg-bg active:bg-line-soft",
  /** Quiet action on white (dialog cancel). */
  soft: "border-0 bg-bg text-ink hover:bg-line-soft active:bg-line",
  /** Dark action on white (SettleUp "ยืนยันว่าได้รับ"). */
  ink: "border-0 bg-ink text-surface hover:bg-ink-subtle disabled:bg-disabled",
  /** Destructive confirm. */
  danger: "border-0 bg-danger text-surface hover:bg-danger-ink active:bg-danger-ink",
  /** Destructive entry point ("ลบรายการนี้"). */
  "danger-outline": "border border-danger-line bg-surface text-danger hover:bg-danger-soft active:bg-danger-soft",
  /** Dashed "add" button (คัดลอกลิงก์เชิญ / + สถานที่). */
  dashed: "border-[1.5px] border-dashed border-control bg-transparent font-medium text-ink hover:border-ink-muted hover:bg-surface",
} as const;

const sizes = {
  md: "min-h-12 rounded-icon px-4 text-[15px]", // 48
  lg: "min-h-[52px] rounded-icon px-5 text-base", // 52
  sm: "min-h-11 rounded-chip px-3.5 text-sm", // 44
} as const;

export type ButtonVariant = keyof typeof variants;

interface CommonProps {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  block?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

export function buttonClasses({ variant = "primary", size = "md", block, className }: Omit<CommonProps, "children" | "icon">) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold no-underline transition-colors duration-150",
    "disabled:cursor-not-allowed cursor-pointer select-none",
    variants[variant],
    sizes[size],
    block && "w-full",
    className,
  );
}

export function Button({ variant, size, block, icon, children, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends CommonProps {
  href: string;
}

/** Same look as Button, for navigation (uses next/link). */
export function ButtonLink({ href, variant, size, block, icon, children, className }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })}>
      {icon}
      {children}
    </Link>
  );
}
