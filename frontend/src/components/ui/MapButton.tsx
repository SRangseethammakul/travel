import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/** Icon button that opens a Place's Google Maps link in a new tab. Sits above a full-card link overlay (`relative z-10`). */
export function MapButton({ href, name, className }: { href: string; name: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`เปิด ${name} ใน Google Maps`}
      className={cn(
        "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-[14px] text-primary no-underline hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
    >
      <Icon name="place" size={20} />
    </a>
  );
}
