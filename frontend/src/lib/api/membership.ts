/**
 * Reads for sign-in, invites and joining (Login, JoinTrip, Members).
 * Same rules as queries.ts: backend reads only.
 */
import type { Satang } from "@/lib/money/format";
import { ApiError, apiFetch } from "./http";
import { getSignedInUser } from "./session";
import type { ID, Invite, Member, Trip, User } from "./types";

/**
 * The signed-in User id (A1), or null when signed out. Unlike getCurrentUserId()
 * this never redirects — use it on public pages (Login, JoinTrip) that must
 * tell "signed out" apart.
 */
export async function getSessionUserId(): Promise<ID | null> {
  return (await getSignedInUser())?.id ?? null;
}

/** Whether the invite can still be used at `now`. */
export function isInviteActive(invite: Pick<Invite, "expiresAt">, now: Date = new Date()): boolean {
  return invite.expiresAt === null || new Date(invite.expiresAt).getTime() > now.getTime();
}

/** An Unclaimed Member offered on JoinTrip, with what is already recorded in their name (B9). */
export interface UnclaimedChoice {
  member: Member;
  expenseCount: number;
  /** Sum of their Shares. */
  total: Satang;
}

/**
 * What JoinTrip and Login show for an invite token (B9 GET /api/join/:token).
 * B9 does not send the inviter or the trip's member / place / expense counts,
 * so those are null until the backend adds them.
 */
export interface InvitePreview {
  trip: Pick<Trip, "name" | "destination" | "startDate" | "endDate" | "cover">;
  requireApproval: boolean;
  unclaimed: UnclaimedChoice[];
  /** User who created the trip ("Act ชวนคุณเข้าร่วมทริป"). */
  inviter: User | null;
  memberCount: number | null;
  placeCount: number | null;
  expenseCount: number | null;
}

interface JoinPreviewResponse {
  trip: InvitePreview["trip"];
  requireApproval: boolean;
  members: UnclaimedChoice[];
}

/**
 * B9 (public) — the preview for an invite token, or null when the token is
 * unknown (404) or the invite has expired (410).
 */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  try {
    const res = await apiFetch<JoinPreviewResponse>(`/api/join/${encodeURIComponent(token)}`, { allowSignedOut: true });
    return {
      trip: res.trip,
      requireApproval: res.requireApproval,
      unclaimed: res.members,
      inviter: null,
      memberCount: null,
      placeCount: null,
      expenseCount: null,
    };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 410)) return null;
    throw e;
  }
}

/** B38 GET /api/checklist/suggestions?scope= — suggestion texts for a scope. */
export async function getChecklistSuggestions(scope: "group" | "personal"): Promise<string[]> {
  const list = await apiFetch<{ text: string; category: string }[]>(`/api/checklist/suggestions?scope=${scope}`);
  return list.map((s) => s.text);
}

/**
 * Which expiry choice (1 วัน / 7 วัน / ไม่หมดอายุ) to show as selected. The
 * Invite keeps only `expiresAt`, so ≤ 1 day left reads as "1d".
 */
export function inviteExpiryOption(invite: Pick<Invite, "expiresAt">, now: Date = new Date()): "1d" | "7d" | "never" {
  if (invite.expiresAt === null) return "never";
  return new Date(invite.expiresAt).getTime() - now.getTime() <= 86_400_000 ? "1d" : "7d";
}
