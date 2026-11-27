/**
 * Search field as a plain GET form: submitting puts `q` in the URL (and drops `page`),
 * keeping the other params. No client JS needed.
 */
export function SearchBox({
  action,
  placeholder,
  value,
  keep = {},
}: {
  action: string;
  placeholder: string;
  value?: string;
  /** Other params to carry along (filter, sort…). */
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} role="search" className="flex w-80 items-center rounded-chip border border-line-strong focus-within:outline-2 focus-within:outline-primary">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input
        type="search"
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder.replace("…", "")}
        className="h-11 min-w-0 flex-1 rounded-chip border-0 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
    </form>
  );
}
