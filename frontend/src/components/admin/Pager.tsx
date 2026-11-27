import Link from "next/link";
import { hasNext, rangeLabel } from "@/utils/admin";

const base = "flex min-h-11 items-center rounded-chip border border-line-strong bg-surface px-3.5 text-[13px] no-underline";

/** "แสดง x–y จาก N" + ก่อนหน้า / ถัดไป. `href(page)` builds the URL for a page. */
export function Pager({
  page,
  pageSize,
  total,
  shown,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  href: (page: number) => string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2 text-[13px] text-ink-muted">
      <span>{rangeLabel(page, pageSize, total, shown)}</span>
      <nav aria-label="แบ่งหน้า" className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${base} font-semibold text-ink hover:bg-bg hover:text-ink`}>
            ก่อนหน้า
          </Link>
        ) : (
          <span aria-disabled="true" className={`${base} text-disabled`}>
            ก่อนหน้า
          </span>
        )}
        {hasNext(page, pageSize, total) ? (
          <Link href={href(page + 1)} className={`${base} font-semibold text-ink hover:bg-bg hover:text-ink`}>
            ถัดไป
          </Link>
        ) : (
          <span aria-disabled="true" className={`${base} text-disabled`}>
            ถัดไป
          </span>
        )}
      </nav>
    </div>
  );
}
