import { ButtonLink } from "./Button";
import { Icon } from "./Icon";

interface NotFoundStateProps {
  title: string;
  body: string;
  href: string;
  backLabel: string;
}

/** Full-page 404 in the app's look (self-designed: no mockup). Used by the not-found.tsx files. */
export function NotFoundState({ title, body, href, backLabel }: NotFoundStateProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="flex w-full flex-col items-center gap-2 rounded-card bg-surface px-5 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-chip bg-stay-soft text-ink-muted">
          <Icon name="search" size={22} />
        </span>
        <h1 className="m-0 mt-1 font-display text-lg font-semibold text-ink">{title}</h1>
        <p className="m-0 text-[13px] text-ink-muted">{body}</p>
        <ButtonLink href={href} block className="mt-4">
          {backLabel}
        </ButtonLink>
      </div>
    </main>
  );
}
