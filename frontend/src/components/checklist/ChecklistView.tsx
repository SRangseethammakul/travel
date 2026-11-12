"use client";

import { useId, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { addChecklistItemAction, assignChecklistItem, removeChecklistItem, toggleChecklistItem } from "@/lib/api/checklist-actions";
import type { ChecklistScope, ColorKey, ID } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { MAX_CHECKLIST_TEXT } from "@/lib/checklist";

export interface ChecklistRow {
  id: ID;
  text: string;
  done: boolean;
  /** "เสร็จโดย Act" for ticked group items. */
  meta: string | null;
  assigneeId: ID | null;
  canEdit: boolean;
  canTick: boolean;
}

export interface ChecklistPerson {
  id: ID;
  name: string;
  color: ColorKey;
}

interface ChecklistViewProps {
  tripId: ID;
  scope: ChecklistScope;
  groups: { category: string; items: ChecklistRow[] }[];
  people: ChecklistPerson[];
  suggestions: string[];
  canAdd: boolean;
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
      {children}
    </p>
  );
}

/** Rows, suggestions and the add bar of one checklist scope. */
export function ChecklistView({ tripId, scope, groups, people, suggestions, canAdd }: ChecklistViewProps) {
  const inputId = useId();
  const isGroup = scope === "group";
  const [draft, setDraft] = useState("");
  const [assigning, setAssigning] = useState<ChecklistRow | null>(null);
  const [removing, setRemoving] = useState<ChecklistRow | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));

  const run = (fn: () => Promise<{ error: string } | null>, after?: () => void) =>
    startTransition(async () => {
      setError("");
      const result = await fn();
      if (result?.error) setError(result.error);
      else after?.();
    });

  const add = (text: string, clearDraft: boolean) => {
    const clean = text.trim();
    if (!clean) return;
    run(() => addChecklistItemAction(tripId, scope, clean), clearDraft ? () => setDraft("") : undefined);
  };

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 px-5 pt-1 pb-4">
        {error ? <ErrorText>{error}</ErrorText> : null}

        {groups.length ? (
          groups.map((g) => (
            <section key={g.category} aria-label={g.category} className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-semibold text-ink-muted">{g.category}</h2>
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
                {g.items.map((it) => {
                  const who = it.assigneeId ? byId.get(it.assigneeId) : undefined;
                  return (
                    <li key={it.id} className="flex min-h-14 items-center gap-1 border-b border-line-soft pr-1.5 last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={it.done}
                        disabled={!it.canTick || pending}
                        onClick={() => run(() => toggleChecklistItem(tripId, it.id, !it.done))}
                        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-1.5 pl-3.5 text-left text-ink disabled:cursor-default"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-lg border-2 text-surface transition-colors duration-150",
                            it.done ? "border-primary bg-primary" : "border-disabled bg-surface",
                          )}
                        >
                          <Icon name="check" size={14} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className={cn("text-[15px] font-medium", it.done ? "text-ink-muted line-through" : "text-ink")}>{it.text}</span>
                          {it.meta ? <span className="text-xs text-ink-muted">{it.meta}</span> : null}
                        </span>
                      </button>
                      {isGroup ? (
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          disabled={!it.canEdit || pending}
                          onClick={() => setAssigning(it)}
                          aria-label={`คนรับผิดชอบ: ${who?.name ?? "ยังไม่มีคนรับ"}${it.canEdit ? " แตะเพื่อเปลี่ยน" : ""}`}
                          className="relative flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface py-0 pr-2 pl-1 text-xs font-semibold text-ink-subtle before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:border-ink-muted disabled:cursor-default disabled:hover:border-line"
                        >
                          {who ? (
                            <Avatar name={who.name} color={who.color} size="xs" />
                          ) : (
                            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-disabled font-display text-[11px] font-semibold text-surface">
                              ?
                            </span>
                          )}
                          {who?.name ?? "ใครรับ?"}
                        </button>
                      ) : null}
                      {it.canEdit ? (
                        <button
                          type="button"
                          aria-label={`ลบ ${it.text}`}
                          disabled={pending}
                          onClick={() => setRemoving(it)}
                          className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-ink-muted before:absolute before:-inset-1 before:content-[''] hover:bg-bg hover:text-danger"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        ) : (
          <p className="m-0 rounded-card bg-surface px-4 py-6 text-center text-sm text-ink-muted">
            {isGroup ? "ยังไม่มีรายการของกลุ่ม เพิ่มเองหรือกดจากรายการแนะนำ" : "ยังไม่มีรายการส่วนตัว เพิ่มของที่ต้องเตรียมได้เลย"}
          </p>
        )}

        {canAdd && suggestions.length ? (
          <section aria-labelledby="suggest-h" className="flex flex-col gap-2 rounded-tile bg-surface p-3.5">
            <h2 id="suggest-h" className="m-0 text-[13px] font-semibold">
              รายการแนะนำ
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => add(s, false)}
                  aria-label={`เพิ่ม ${s}`}
                  className="relative flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-primary bg-primary-wash px-3 text-[13px] font-semibold text-primary-ink before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-primary-soft disabled:cursor-wait"
                >
                  <Icon name="plus" size={12} />
                  {s}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {canAdd ? (
        <form
          className="sticky bottom-0 z-10 flex gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft, true);
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            เพิ่มรายการใหม่
          </label>
          <input
            id={inputId}
            value={draft}
            maxLength={MAX_CHECKLIST_TEXT}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isGroup ? "เพิ่มรายการของกลุ่ม" : "เพิ่มของที่ต้องเตรียม"}
            className="h-[50px] min-w-0 flex-1 rounded-icon border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted"
          />
          <Button type="submit" disabled={!draft.trim() || pending} aria-busy={pending || undefined} className="h-[50px] px-[18px]">
            เพิ่ม
          </Button>
        </form>
      ) : null}

      <BottomSheet
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        caption="คนรับผิดชอบ"
        title={assigning?.text ?? ""}
        footer={
          <Button variant="soft" block onClick={() => setAssigning(null)}>
            ยกเลิก
          </Button>
        }
      >
        <div role="radiogroup" aria-label="เลือกคนรับผิดชอบ" className="flex flex-col gap-2">
          {[null, ...people].map((p) => {
            const on = (assigning?.assigneeId ?? null) === (p?.id ?? null);
            return (
              <button
                key={p?.id ?? "none"}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                onClick={() => assigning && run(() => assignChecklistItem(tripId, assigning.id, p?.id ?? null), () => setAssigning(null))}
                className={cn(
                  "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-icon border-[1.5px] px-3.5 text-left text-[15px] font-semibold text-ink transition-colors duration-150 disabled:cursor-wait",
                  on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-ink-muted",
                )}
              >
                {p ? (
                  <Avatar name={p.name} color={p.color} size="sm" />
                ) : (
                  <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-disabled font-display text-[13px] font-semibold text-surface">
                    ?
                  </span>
                )}
                <span className="flex-1">{p?.name ?? "ยังไม่มีคนรับ"}</span>
                {on ? <Icon name="check" size={18} className="text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={removing !== null}
        title={`ลบ "${removing?.text ?? ""}"?`}
        description={isGroup ? "รายการนี้จะหายไปจากเช็คลิสต์ของทุกคนในทริป" : "รายการนี้จะหายไปจากเช็คลิสต์ส่วนตัวของคุณ"}
        confirmLabel="ลบรายการ"
        pending={pending}
        onConfirm={() => removing && run(() => removeChecklistItem(tripId, removing.id), () => setRemoving(null))}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
