"use client";

import { useId, useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { solidBg } from "@/components/ui/colors";
import { addPillClass, fieldClass, pillClass } from "@/components/ui/field";
import { createTagGroup, deleteTagAction, moveTagToGroup, renameAreaAction, renameTagAction, ungroupTags } from "@/lib/api/plan-actions";
import type { ColorKey, ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { groupTags } from "@/lib/place-form";

export interface ManagedTag {
  id: ID;
  name: string;
  group: string | null;
  color?: ColorKey;
  /** Places (any trip) that carry this tag. */
  count: number;
}

export interface CityAreas {
  city: string;
  areas: { area: string | null; count: number }[];
}

interface TagManagerProps {
  tripId: ID;
  tags: ManagedTag[];
  areas: CityAreas[];
  canEditAreas: boolean;
}

type Result = { error: string } | null;

function ErrorText({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
      {text}
    </p>
  ) : null;
}

/** ManageTags (17): the User's tags by group, plus the trip's areas. */
export function TagManager({ tripId, tags, areas, canEditAreas }: TagManagerProps) {
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selId, setSelId] = useState<ID | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [groupSheet, setGroupSheet] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPick, setCreatePick] = useState<ID[]>([]);
  const [areaSel, setAreaSel] = useState<{ city: string; area: string } | null>(null);
  const [areaText, setAreaText] = useState("");

  const groups = groupTags(tags);
  const groupNames = groups.flatMap((g) => (g.group ? [g.group] : []));
  const sel = tags.find((t) => t.id === selId) ?? null;

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    startTransition(async () => {
      setError("");
      const r = await fn();
      if (r?.error) setError(r.error);
      else after?.();
    });

  const closeTag = () => {
    setSelId(null);
    setRenaming(null);
    setNewGroup(null);
    setError("");
  };

  return (
    <main className="flex flex-col gap-4 px-5 pt-2 pb-6">
      {groups.map((g) => (
        <section key={g.group ?? "\u0000none"} aria-labelledby={`${ids}-${g.group ?? "none"}`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id={`${ids}-${g.group ?? "none"}`} className="m-0 text-sm font-semibold text-ink-subtle">
              {g.group ?? "ไม่มีกลุ่ม"} <span className="font-normal text-ink-muted">· {g.tags.length}</span>
            </h2>
            {g.group ? (
              <button
                type="button"
                aria-label={`ตัวเลือกกลุ่ม ${g.group}`}
                onClick={() => {
                  setGroupSheet(g.group);
                  setGroupName(g.group ?? "");
                }}
                className="flex size-11 cursor-pointer items-center justify-center rounded-chip border-0 bg-transparent text-ink-muted hover:bg-line-soft hover:text-ink"
              >
                <Icon name="more" size={20} />
              </button>
            ) : null}
          </div>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
            {g.tags.map((t) => (
              <li key={t.id} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelId(t.id)}
                  aria-haspopup="dialog"
                  className={cn(
                    "flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-0 px-3.5 text-left text-ink transition-colors hover:bg-surface-alt",
                    selId === t.id ? "bg-primary-soft" : "bg-surface",
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2.5 rounded-full", t.color ? solidBg[t.color] : g.group ? "bg-type-food" : "bg-disabled")} />
                  <span className="flex-1 font-medium">#{t.name}</span>
                  <span className="text-[13px] text-ink-muted">{t.count} ที่</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!tags.length ? (
        <div className="flex flex-col items-center gap-2 rounded-tile bg-surface px-5 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-chip bg-primary-soft text-primary">
            <Icon name="tag" size={22} />
          </span>
          <p className="m-0 font-semibold">ยังไม่มี tag ของคุณ</p>
          <p className="m-0 text-[13px] text-ink-muted">พิมพ์ tag ตอนเพิ่มสถานที่ แล้วมาจัดกลุ่มที่นี่ได้</p>
        </div>
      ) : (
        <Button
          variant="dashed"
          block
          icon={<Icon name="plus" size={16} />}
          className="rounded-2xl text-sm"
          onClick={() => {
            setCreateOpen(true);
            setGroupName("");
            setCreatePick([]);
          }}
        >
          สร้างกลุ่มใหม่
        </Button>
      )}

      <section aria-labelledby={`${ids}-areas`} className="flex flex-col gap-2">
        <h2 id={`${ids}-areas`} className="m-0 text-sm font-semibold text-ink-subtle">
          ย่านในทริปนี้ <span className="font-normal text-ink-muted">· ใช้ร่วมกันทั้งทริป</span>
        </h2>
        <div className="flex flex-col gap-2.5 rounded-tile bg-surface p-3.5">
          {areas.map((c) => (
            <div key={c.city} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">{c.city}</span>
              <div className="flex flex-wrap gap-1.5">
                {c.areas.map((a) =>
                  canEditAreas && a.area ? (
                    <button
                      key={a.area}
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`${a.area} ${a.count} ที่ · เปลี่ยนชื่อย่าน`}
                      onClick={() => {
                        setAreaSel({ city: c.city, area: a.area! });
                        setAreaText(a.area!);
                      }}
                      className="relative min-h-9 cursor-pointer rounded-full border-0 bg-bg px-2.5 text-[13px] text-ink before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-line"
                    >
                      {a.area} · {a.count}
                    </button>
                  ) : (
                    <span key={a.area ?? "\u0000"} className={cn("inline-flex items-center rounded-full bg-bg px-2.5 text-[13px]", canEditAreas ? "min-h-9" : "py-1")}>
                      {a.area ?? "ไม่ระบุย่าน"} · {a.count}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
          {!areas.length ? <p className="m-0 text-[13px] text-ink-muted">ยังไม่มีย่านในทริปนี้</p> : null}
          {canEditAreas && areas.length ? (
            <p className="m-0 text-xs leading-normal text-ink-muted">แตะชื่อย่านเพื่อเปลี่ยนชื่อ หรือรวมย่านที่พิมพ์ซ้ำกัน เช่น &quot;shinjuku&quot; กับ &quot;Shinjuku&quot;</p>
          ) : null}
        </div>
      </section>

      {/* Tag sheet */}
      <BottomSheet
        open={!!sel && !confirmDelete}
        onClose={closeTag}
        title={sel ? `#${sel.name}` : ""}
        footer={
          <Button variant="ink" block onClick={closeTag} data-autofocus>
            เสร็จ
          </Button>
        }
      >
        {sel ? (
          <>
            <span className="text-[13px] font-semibold">ย้ายไปกลุ่ม</span>
            <div role="radiogroup" aria-label="ย้ายไปกลุ่ม" className="flex flex-wrap gap-2">
              {[...groupNames, null].map((g) => (
                <button
                  key={g ?? "\u0000none"}
                  type="button"
                  role="radio"
                  aria-checked={sel.group === g}
                  disabled={pending}
                  onClick={() => run(() => moveTagToGroup(sel.id, g))}
                  className={pillClass(sel.group === g, "primary")}
                >
                  {g ?? "ไม่มีกลุ่ม"}
                </button>
              ))}
              {newGroup === null ? (
                <button type="button" onClick={() => setNewGroup("")} className={addPillClass}>
                  <Icon name="plus" size={12} />
                  กลุ่มใหม่
                </button>
              ) : null}
            </div>
            {newGroup !== null ? (
              <div className="flex gap-2">
                <label htmlFor={`${ids}-ng`} className="sr-only">
                  ชื่อกลุ่มใหม่
                </label>
                <input id={`${ids}-ng`} maxLength={30} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="ชื่อกลุ่ม เช่น อาหาร" className={cn(fieldClass, "h-11 flex-1")} />
                <Button size="sm" disabled={!newGroup.trim() || pending} onClick={() => run(() => moveTagToGroup(sel.id, newGroup), () => setNewGroup(null))}>
                  ย้าย
                </Button>
              </div>
            ) : null}
            {renaming !== null ? (
              <div className="flex gap-2">
                <label htmlFor={`${ids}-rn`} className="sr-only">
                  ชื่อ tag ใหม่
                </label>
                <input id={`${ids}-rn`} maxLength={30} value={renaming} onChange={(e) => setRenaming(e.target.value)} className={cn(fieldClass, "h-11 flex-1")} />
                <Button size="sm" disabled={!renaming.trim() || pending} onClick={() => run(() => renameTagAction(sel.id, renaming), () => setRenaming(null))}>
                  บันทึก
                </Button>
              </div>
            ) : null}
            <ErrorText text={error} />
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setRenaming(sel.name)} disabled={renaming !== null}>
                เปลี่ยนชื่อ
              </Button>
              <Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>
                ลบ tag
              </Button>
            </div>
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={!!sel && confirmDelete}
        title={sel ? `ลบ #${sel.name}?` : ""}
        description={
          sel
            ? sel.count
              ? `tag นี้จะถูกถอดออกจาก ${sel.count} ที่ในทุกทริปของคุณ สถานที่ยังอยู่ครบ`
              : "tag นี้ยังไม่ได้ใช้กับที่ไหน ลบได้เลย"
            : ""
        }
        confirmLabel="ลบ tag"
        pending={pending}
        onConfirm={() =>
          sel &&
          run(
            () => deleteTagAction(sel.id),
            () => {
              setConfirmDelete(false);
              closeTag();
            },
          )
        }
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Group options */}
      <BottomSheet
        open={groupSheet !== null}
        onClose={() => setGroupSheet(null)}
        caption="กลุ่ม"
        title={groupSheet ?? ""}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => ungroupTags(tags.filter((t) => t.group === groupSheet).map((t) => t.id)), () => setGroupSheet(null))}
            >
              ยกเลิกกลุ่ม
            </Button>
            <Button
              disabled={pending || !groupName.trim() || groupName.trim() === groupSheet}
              onClick={() => run(() => createTagGroup(groupName, tags.filter((t) => t.group === groupSheet).map((t) => t.id)), () => setGroupSheet(null))}
            >
              บันทึกชื่อ
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-gn`} className="text-[13px] font-semibold">
            ชื่อกลุ่ม
          </label>
          <input id={`${ids}-gn`} maxLength={30} value={groupName} onChange={(e) => setGroupName(e.target.value)} className={fieldClass} />
        </div>
        <p className="m-0 text-xs text-ink-muted">ยกเลิกกลุ่มแล้ว tag ทั้งหมดจะย้ายไป &quot;ไม่มีกลุ่ม&quot; ไม่มี tag ไหนถูกลบ</p>
        <ErrorText text={error} />
      </BottomSheet>

      {/* New group */}
      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="สร้างกลุ่มใหม่"
        footer={
          <Button
            block
            disabled={pending || !groupName.trim() || !createPick.length}
            onClick={() => run(() => createTagGroup(groupName, createPick), () => setCreateOpen(false))}
          >
            สร้างกลุ่ม {createPick.length ? `(${createPick.length} tag)` : ""}
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-cg`} className="text-[13px] font-semibold">
            ชื่อกลุ่ม
          </label>
          <input id={`${ids}-cg`} maxLength={30} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="เช่น อาหาร" className={fieldClass} />
        </div>
        <span className="text-[13px] font-semibold">ย้าย tag เข้ากลุ่มนี้</span>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = createPick.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCreatePick(on ? createPick.filter((x) => x !== t.id) : [...createPick, t.id])}
                className={cn(
                  "relative min-h-10 cursor-pointer rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
                  on ? "border-primary bg-primary-soft text-primary-ink" : "border-line-strong bg-surface text-ink hover:border-ink-muted",
                )}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
        <ErrorText text={error} />
      </BottomSheet>

      {/* Area rename / merge */}
      <BottomSheet
        open={!!areaSel}
        onClose={() => setAreaSel(null)}
        caption={areaSel ? `ย่านใน ${areaSel.city}` : ""}
        title={areaSel?.area ?? ""}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setAreaSel(null)}>
              ยกเลิก
            </Button>
            <Button
              disabled={pending || !areaText.trim() || areaText.trim() === areaSel?.area}
              onClick={() => areaSel && run(() => renameAreaAction(tripId, areaSel.city, areaSel.area, areaText), () => setAreaSel(null))}
            >
              บันทึก
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-ar`} className="text-[13px] font-semibold">
            ชื่อย่าน
          </label>
          <input id={`${ids}-ar`} maxLength={40} value={areaText} onChange={(e) => setAreaText(e.target.value)} className={fieldClass} />
        </div>
        {areaSel ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-muted">หรือรวมเข้ากับย่านที่มีอยู่</span>
            <div className="flex flex-wrap gap-2">
              {(areas.find((c) => c.city === areaSel.city)?.areas ?? [])
                .filter((a) => a.area && a.area !== areaSel.area)
                .map((a) => (
                  <button key={a.area} type="button" aria-pressed={areaText === a.area} onClick={() => setAreaText(a.area!)} className={pillClass(areaText === a.area)}>
                    {a.area}
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        <ErrorText text={error} />
      </BottomSheet>
    </main>
  );
}
