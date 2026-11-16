import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

interface FabProps {
  href: string;
  label: string;
  className?: string;
}

/**
 * Floating "+ เพิ่ม…" button, 20px from the right edge of the app frame (max 640px) and
 * 96px from the bottom (above the tab bar).
 */
export function Fab({ href, label, className }: FabProps) {
  return (
    <Link
      href={href}
      className={cn(
        "fixed right-[max(1.25rem,calc((100vw-var(--container-app))/2+1.25rem))] bottom-[calc(96px+env(safe-area-inset-bottom))] z-20",
        "flex h-[52px] items-center gap-2 rounded-tile bg-primary px-5 text-[15px] font-semibold text-surface no-underline shadow-fab",
        "transition-[background-color,transform] duration-150 hover:bg-primary-hover hover:text-surface active:scale-[0.97]",
        className,
      )}
    >
      <Icon name="plus" size={18} />
      {label}
    </Link>
  );
}
