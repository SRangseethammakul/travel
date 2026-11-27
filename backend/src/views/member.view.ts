import type { MemberDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

/** Member id → picture of the linked User. Built per request by `utils/member-avatars.ts`. */
export type AvatarMap = ReadonlyMap<string, string>;

/** Member as in frontend types, plus `status` (pending Members are listed for approval) and `avatarUrl` when the linked User has a picture. */
export const memberView = (m: MemberDoc, avatars?: AvatarMap) => {
  const avatarUrl = avatars?.get(m._id);
  return avatarUrl ? { ...serialize(m), avatarUrl } : serialize(m);
};
