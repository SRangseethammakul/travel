import type { Metadata } from "next";
import { ChecklistView, type ChecklistRow } from "@/components/checklist/ChecklistView";
import { IconLink } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { getChecklist, getChecklistSuggestions, getMembers, requireTripMember } from "@/lib/api";
import type { ChecklistItem, ChecklistScope } from "@/lib/api/types";
import { groupChecklist, remainingSuggestions } from "@/lib/checklist";
import { formatCountdown, todayISO } from "@/lib/date";
import { canEditChecklistItem, canTickChecklistItem } from "@/lib/permissions";

export const metadata: Metadata = { title: "เช็คลิสต์ · [ชื่อแอป]" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

const doneCount = (items: ChecklistItem[]) => items.filter((i) => i.done).length;

export default async function ChecklistPage({ params, searchParams }: PageProps<"/trips/[tripId]/checklist">) {
  const { tripId } = await params;
  const scope: ChecklistScope = first((await searchParams).scope) === "personal" ? "personal" : "group";
  const { trip, me } = await requireTripMember(tripId);
  const [items, members, suggested] = await Promise.all([getChecklist(tripId), getMembers(tripId), getChecklistSuggestions(scope)]);
  const base = `/trips/${encodeURIComponent(tripId)}`;

  const groupItems = items.filter((i) => i.scope === "group");
  // getChecklist already drops other people's personal items; filter again so only mine can show.
  const personalItems = items.filter((i) => i.scope === "personal" && i.ownerId === me.id);
  const list = scope === "group" ? groupItems : personalItems;
  const done = doneCount(list);
  const pct = list.length ? Math.round((done * 100) / list.length) : 0;
  const nameById = new Map(members.map((m) => [m.id, m.id === me.id ? "คุณ" : m.displayName]));

  const groups = groupChecklist(list).map((g) => ({
    category: g.category,
    items: g.items.map(
      (it): ChecklistRow => ({
        id: it.id,
        text: it.text,
        done: it.done,
        meta: scope === "group" && it.done && it.doneBy ? `เสร็จโดย ${nameById.get(it.doneBy) ?? "สมาชิกเดิม"}` : null,
        assigneeId: it.assigneeId ?? null,
        canEdit: canEditChecklistItem(me, it),
        canTick: canTickChecklistItem(me, it),
      }),
    ),
  }));
  const canAdd = canEditChecklistItem(me, { scope, ownerId: me.id });
  const suggestions = remainingSuggestions(suggested, list);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex flex-col gap-3 px-5 pt-4 pb-3">
        <div className="-ml-2 flex items-center gap-2">
          <IconLink href={base} icon="back" label="ย้อนกลับ" variant="ghost" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="m-0 font-display text-lg font-semibold">เช็คลิสต์</h1>
            <span className="truncate text-xs text-ink-muted">
              {trip.name} · {formatCountdown(todayISO(), trip.startDate, trip.endDate)}
            </span>
          </div>
        </div>
        <Segmented
          label="ประเภทเช็คลิสต์"
          value={scope}
          size="city"
          options={[
            { value: "group", label: "กลุ่ม", sublabel: `${doneCount(groupItems)}/${groupItems.length}`, href: `${base}/checklist` },
            { value: "personal", label: "ส่วนตัว", sublabel: `${doneCount(personalItems)}/${personalItems.length}`, href: `${base}/checklist?scope=personal` },
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-ink-subtle">{scope === "group" ? "ทุกคนในทริปเห็นและติ๊กได้" : "เห็นแค่คุณคนเดียว"}</span>
            <span className="font-semibold">
              {done}/{list.length} เสร็จแล้ว
            </span>
          </div>
          <div role="img" aria-label={`ทำเสร็จ ${done} จาก ${list.length}`} className="h-2 overflow-hidden rounded-full bg-line-strong">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <ChecklistView
        key={scope}
        tripId={tripId}
        scope={scope}
        groups={groups}
        people={members.map((m) => ({ id: m.id, name: m.displayName, color: m.color }))}
        suggestions={suggestions}
        canAdd={canAdd}
      />
    </div>
  );
}
