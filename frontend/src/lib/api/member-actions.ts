"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "./expense-actions";
import { actionError, apiFetch, tripPath } from "./http";
import { getInvite } from "./queries";
import type { ID, Invite, InviteExpiry, Member, Role } from "./types";

/**
 * Members page (owner). The backend decides who may do what (B5–B8, B11) and
 * refuses with a Thai message, e.g. the last owner (409 `last_owner`) or a
 * Member who still has Outstanding (409 `outstanding_not_zero`).
 */

const ROLES: readonly Role[] = ["owner", "editor", "viewer"];
const EXPIRIES: readonly InviteExpiry[] = ["1d", "7d", "never"];

const memberPath = (tripId: ID, memberId: ID) => `${tripPath(tripId)}/members/${encodeURIComponent(memberId)}`;

async function write(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    return { error: actionError(e).error };
  }
  revalidatePath("/", "layout");
  return null;
}

/** B5 */
export async function changeRole(tripId: ID, memberId: ID, role: Role): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { error: "สิทธิ์ไม่ถูกต้อง" };
  return write(() => apiFetch<Member>(memberPath(tripId, memberId), { method: "PATCH", json: { role } }));
}

/** B6 */
export async function removeMemberAction(tripId: ID, memberId: ID): Promise<ActionResult> {
  return write(() => apiFetch<void>(memberPath(tripId, memberId), { method: "DELETE" }));
}

/** B11 — let a `pending` Member in. */
export async function approveMemberAction(tripId: ID, memberId: ID): Promise<ActionResult> {
  return write(() => apiFetch<Member>(`${memberPath(tripId, memberId)}/approve`, { method: "POST" }));
}

/** B7 needs both settings; the one not being changed comes from the current invite (A5). */
async function putInvite(tripId: ID, patch: { expiresIn?: InviteExpiry; requireApproval?: boolean }): Promise<Invite> {
  const current = await getInvite(tripId);
  return apiFetch<Invite>(`${tripPath(tripId)}/invite`, {
    method: "PUT",
    json: {
      expiresIn: patch.expiresIn ?? (current ? currentExpiry(current) : "7d"),
      requireApproval: patch.requireApproval ?? current?.requireApproval ?? true,
    },
  });
}

/** Keeping the approval setting must not stretch an expiry: "1d"/"7d" restart from now, so keep what is closest. */
function currentExpiry(invite: Invite): InviteExpiry {
  if (invite.expiresAt === null) return "never";
  return new Date(invite.expiresAt).getTime() - Date.now() <= 86_400_000 ? "1d" : "7d";
}

/** B7 — also creates the invite when the trip has none. */
export async function setInviteExpiry(tripId: ID, expiry: InviteExpiry): Promise<ActionResult> {
  if (!EXPIRIES.includes(expiry)) return { error: "ระยะเวลาไม่ถูกต้อง" };
  return write(() => putInvite(tripId, { expiresIn: expiry }));
}

/** B7 */
export async function setInviteApproval(tripId: ID, requireApproval: boolean): Promise<ActionResult> {
  return write(() => putInvite(tripId, { requireApproval: Boolean(requireApproval) }));
}

/**
 * B8 new token (the old link stops working), then B7 so the expiry restarts
 * from now — B8 alone keeps an expired link expired.
 */
export async function resetInviteAction(tripId: ID, expiry: InviteExpiry): Promise<ActionResult> {
  const expiresIn = EXPIRIES.includes(expiry) ? expiry : "7d";
  return write(async () => {
    await apiFetch<Invite>(`${tripPath(tripId)}/invite/reset`, { method: "POST" });
    await putInvite(tripId, { expiresIn });
  });
}
