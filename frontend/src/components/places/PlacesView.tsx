"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Chip, TagLabel } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { placeTypeStyle } from "@/components/ui/colors";
import type { ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  cityTabs,
  filterPlaces,
  groupPlaces,
  inCity,
  placeFiltersQuery,
  placeRowSub,
  tagOptions,
  type PlaceFilters,
  type PlaceGroupBy,
  type PlaceRow,
} from "@/lib/places";

interface PlacesViewProps {
  rows: PlaceRow[];
  tags: [ID, string][];
  cities: string[];
  filters: PlaceFilters;
  /** `/trips/<id>` */
  base: string;
}

const groupOptions = [
  { value: "area", label: "ตามย่าน" },
  { value: "type", label: "ตามประเภท" },
] as const;

/**
 * Filters + grouped list. City, tags, "ยังไม่จัดวัน" and grouping live in the
 * URL (parsed on the server and passed in); the search text is local state.
 */
export function PlacesView({ rows, tags, cities, filters, base }: PlacesViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const tagNames = useMemo(() => new Map(tags), [tags]);
  const path = `${base}/places`;
  const href = (next: Partial<PlaceFilters>) => `${path}${placeFiltersQuery({ ...filters, ...next }, cities)}`;
  const go = (next: Partial<PlaceFilters>) => startTransition(() => router.replace(href(next), { scroll: false }));

  const multiCity = cities.length > 1;
  const showCity = multiCity && filters.city === "all";
  const tabs = cityTabs(rows, cities);
  const tagChips = tagOptions(inCity(rows, filters.city), tagNames);
  const shown = filterPlaces(rows, filters, tagNames, query);
  const groups = groupPlaces(shown, filters.group, showCity);
  const toggleTag = (id: ID) =>
    go({ tags: filters.tags.includes(id) ? filters.tags.filter((t) => t !== id) : [...filters.tags, id] });

  return (
    <>
      <div className="flex flex-col gap-2.5 px-5 pb-2.5">
        <label className="flex h-11 items-center gap-2 rounded-icon border border-line bg-surface px-3.5 text-ink-muted focus-within:border-primary">
          <Icon name="search" size={18} />
          <span className="sr-only">ค้นหาสถานที่</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ ย่าน หรือ tag"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
          />
        </label>

        {tabs.length ? (
          <Segmented
            label="เมือง"
            size="city"
            value={filters.city}
            options={tabs.map((t) => ({ value: t.value, label: t.label, sublabel: `${t.count} ที่`, href: href({ city: t.value, tags: [] }) }))}
          />
        ) : null}

        {tagChips.length ? (
          <div role="group" aria-label="กรองด้วย tag" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 py-1 [scrollbar-width:none]">
            {tagChips.map((t) => (
              <Chip key={t.id} size="sm" selected={filters.tags.includes(t.id)} onClick={() => toggleTag(t.id)} className="border">
                <span>
                  <span className="opacity-70" aria-hidden="true">
                    #
                  </span>
                  {t.name}
                </span>
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <Switch label="ยังไม่จัดวัน" checked={filters.unscheduled} onChange={(on) => go({ unscheduled: on })} />
          <Segmented<PlaceGroupBy>
            label="จัดกลุ่มตาม"
            size="sm"
            fill={false}
            value={filters.group}
            options={groupOptions}
            onChange={(group) => go({ group })}
          />
        </div>
      </div>

      <main aria-busy={pending || undefined} className={cn("flex flex-col gap-4 px-5 pt-0.5 pb-24 transition-opacity", pending && "opacity-60")}>
        <p className="sr-only" aria-live="polite">
          พบ {shown.length} ที่
        </p>
        {groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2" aria-label={g.title}>
            <div className="flex items-center gap-2">
              {multiCity && filters.group === "area" ? <Icon name="place" size={16} className="shrink-0 text-ink-subtle" /> : null}
              <h2 className="m-0 flex-1 text-[15px] font-semibold">
                {g.title}
                <span className="font-normal text-ink-muted">
                  {" "}
                  · {g.count} ที่ · ลงแผน {g.planned}
                </span>
              </h2>
            </div>
            {g.noArea ? <p className="-mt-1 mb-0 text-xs text-todo">ยังไม่ได้เลือกย่าน · แตะร้านเพื่อระบุ</p> : null}
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
              {g.items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-line-soft px-3.5 py-3 last:border-b-0">
                  <span aria-hidden="true" className={cn("w-1.5 shrink-0 self-stretch rounded-full", placeTypeStyle[p.type].bar)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="m-0 text-[15px] leading-[1.35] font-semibold">{p.name}</h3>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-ink-muted">{placeRowSub(p, filters.group, showCity)}</span>
                      {p.tagIds.map((id) => (tagNames.has(id) ? <TagLabel key={id}>{tagNames.get(id)}</TagLabel> : null))}
                    </div>
                  </div>
                  {p.days.length ? (
                    <span className="shrink-0 text-xs font-semibold text-primary">วัน {p.days.join(", ")}</span>
                  ) : (
                    <Link
                      href={`${base}/plan/add?place=${encodeURIComponent(p.id)}`}
                      aria-label={`ลงแผน ${p.name}`}
                      className="relative flex min-h-9 shrink-0 items-center rounded-[10px] bg-todo-soft px-2.5 text-xs font-semibold text-todo no-underline before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-todo-line/40 hover:text-todo"
                    >
                      ลงแผน
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length ? (
          <p className="my-6 text-center text-sm text-ink-muted">
            {rows.length ? "ไม่มีสถานที่ที่ตรงกับตัวกรอง" : "ยังไม่มีสถานที่ในทริปนี้ เริ่มจากปุ่มเพิ่มสถานที่"}
          </p>
        ) : null}
      </main>
    </>
  );
}
