import { findAvatarsByUserIds } from "../models/user.model.js";
import type { MemberDoc } from "../schemas/models.js";
import type { AvatarMap } from "../views/member.view.js";

/** One query for all Members of a response: Member id → picture of the linked User (Unclaimed Members and Users without a picture are left out). */
export async function loadAvatars(members: readonly MemberDoc[]): Promise<AvatarMap> {
  const userIds = [...new Set(members.flatMap((m) => (m.userId ? [m.userId] : [])))];
  if (userIds.length === 0) return new Map();
  const byUser = await findAvatarsByUserIds(userIds);
  const out = new Map<string, string>();
  for (const m of members) {
    const url = m.userId ? byUser.get(m.userId) : undefined;
    if (url) out.set(m._id, url);
  }
  return out;
}
