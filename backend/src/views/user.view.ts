import type { UserDoc } from "../schemas/models.js";

/** Public User fields (no OAuth subject). */
export function userView(u: UserDoc) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
    provider: u.provider,
    color: u.color,
  };
}
