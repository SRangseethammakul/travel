import { ButtonLink } from "@/components/ui/Button";

/** Empty search result (mockup AdminUsers "ค้นไม่เจอ"). */
export function EmptyResult({ title, hint, clearHref }: { title: string; hint: string; clearHref: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-[72px] text-center">
      <span className="font-display text-lg font-semibold">{title}</span>
      <span className="text-sm text-ink-muted">{hint}</span>
      <ButtonLink href={clearHref} variant="secondary" size="sm" className="mt-2">
        ล้างการค้นหา
      </ButtonLink>
    </div>
  );
}
