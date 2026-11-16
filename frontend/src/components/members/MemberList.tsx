"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { approveMemberAction, changeRole, removeMemberAction } from "@/lib/api/member-actions";
import type { ID, Member, Role } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { roleLabel } from "@/lib/labels";

const ROLES: Role[] = ["owner", "editor", "viewer"];

export interface MemberRow extends Pick<Member, "id" | "displayName" | "color" | "role"> {
  /** "เข้าสู่ระบบด้วย LINE" or "ยังไม่เข้าร่วม" (the app cannot know whether a link was sent). */
  login: string;
  unclaimed: boolean;
  /** Joined through the invite and waiting for the owner's approval (B11). */
  pending: boolean;
  isMe: boolean;
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="m-0 rounded-chip bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger-ink">
      {children}
    </p>
  );
}

/** Member rows; the owner taps a role to open "สิทธิ์ของ …" (change role, remove). */
export function MemberList({ tripId, rows, canManage }: { tripId: ID; rows: MemberRow[]; canManage: boolean }) {
  const [editId, setEditId] = useState<ID | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [pending, startTransition] = useTransition();
  const editing = rows.find((r) => r.id === editId) ?? null;
  const editName = editing ? `${editing.displayName}${editing.isMe ? " (คุณ)" : ""}` : "";

  const close = () => {
    setEditId(null);
    setError("");
  };

  const pickRole = (role: Role) => {
    if (!editing || role === editing.role) return;
    startTransition(async () => {
      setError("");
      const result = await changeRole(tripId, editing.id, role);
      if (result?.error) setError(result.error);
    });
  };

  const remove = () => {
    if (!editing) return;
    startTransition(async () => {
      setError("");
      const result = await removeMemberAction(tripId, editing.id);
      setConfirmRemove(false);
      if (result?.error) setError(result.error);
      else setEditId(null);
    });
  };

  const approve = (row: MemberRow) =>
    startTransition(async () => {
      setListError("");
      const result = await approveMemberAction(tripId, row.id);
      if (result?.error) setListError(result.error);
    });

  return (
    <>
      {listError ? <ErrorText>{listError}</ErrorText> : null}
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-tile bg-surface p-0">
        {rows.map((m) => {
          const owner = m.role === "owner";
          const badge = cn(
            "flex min-h-10 items-center gap-1 rounded-[10px] border px-2.5 text-[13px] font-semibold",
            owner ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink",
          );
          return (
            <li key={m.id} className="flex min-h-16 items-center gap-3 border-b border-line-soft py-2 pr-3 pl-3.5 last:border-b-0">
              <Avatar name={m.displayName} color={m.color} size="lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">
                  {m.displayName}
                  {m.isMe ? " (คุณ)" : ""}
                </span>
                <span className={cn("text-xs", m.unclaimed || m.pending ? "text-todo" : "text-ink-muted")}>{m.login}</span>
              </span>
              {canManage && m.pending ? (
                <Button size="sm" onClick={() => approve(m)} disabled={pending} aria-label={`อนุมัติ ${m.displayName} เข้าทริป`} className="shrink-0">
                  อนุมัติ
                </Button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`เปลี่ยนสิทธิ์ของ ${m.displayName} ตอนนี้: ${roleLabel[m.role]}`}
                  onClick={() => setEditId(m.id)}
                  className={cn(badge, "relative cursor-pointer before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']", owner ? "hover:bg-ink-subtle" : "hover:bg-bg")}
                >
                  {roleLabel[m.role]}
                  <Icon name="chevronDown" size={14} />
                </button>
              ) : (
                <span className={badge}>{roleLabel[m.role]}</span>
              )}
            </li>
          );
        })}
      </ul>

      <BottomSheet
        open={editing !== null && !confirmRemove}
        onClose={close}
        title={`สิทธิ์ของ ${editName}`}
        footer={
          <Button variant="ink" block onClick={close} className="mt-1">
            เสร็จ
          </Button>
        }
      >
        {editing ? (
          <>
            <div role="radiogroup" aria-label={`สิทธิ์ของ ${editName}`} className="flex flex-col gap-2.5">
              {ROLES.map((r) => {
                const on = editing.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => pickRole(r)}
                    className={cn(
                      "flex min-h-[52px] cursor-pointer items-center justify-between rounded-icon border-[1.5px] px-3.5 text-left text-[15px] font-semibold text-ink transition-colors duration-150 disabled:cursor-wait",
                      on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-ink-muted",
                    )}
                  >
                    {roleLabel[r]}
                    <span aria-hidden="true" className={cn("flex size-5 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-disabled")}>
                      <span className={cn("size-2.5 rounded-full", on ? "bg-primary" : "bg-transparent")} />
                    </span>
                  </button>
                );
              })}
            </div>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {!editing.isMe ? (
              <>
                <Button variant="danger-outline" block onClick={() => setConfirmRemove(true)} disabled={pending} className="mt-1 rounded-icon">
                  นำ {editing.displayName} ออกจากทริป
                </Button>
                <p className="m-0 text-xs leading-normal text-ink-muted">ถ้ายังมียอดค้าง ระบบจะให้เคลียร์ก่อน หรือย้ายส่วนที่ต้องจ่ายไปให้คนอื่น</p>
              </>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        open={confirmRemove && editing !== null}
        title={`นำ ${editing?.displayName ?? ""} ออกจากทริป?`}
        description="เขาจะเปิดทริปนี้ไม่ได้อีก และเช็คลิสต์ส่วนตัวของเขาในทริปนี้จะถูกลบ ถ้าอยากให้กลับมาต้องส่งลิงก์เชิญใหม่"
        confirmLabel="นำออกจากทริป"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}
