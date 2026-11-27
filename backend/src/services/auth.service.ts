import { createHash } from "node:crypto";
import type { OAuthProfile, Provider } from "../auth/oauth.js";
import { isDuplicateKeyError, newId } from "../db/ids.js";
import { PALETTE } from "../domain/colors.js";
import { bumpSessionVersion as bumpVersion, findUserByProvider, insertUser, updateUserProfile } from "../models/user.model.js";
import type { UserDoc } from "../schemas/models.js";

/** Find the User by provider subject, else create one; profile fields are refreshed every login. */
export async function findOrCreateUser(p: Provider, profile: OAuthProfile): Promise<UserDoc> {
  const fields = {
    name: profile.name.slice(0, 100) || "ผู้ใช้",
    email: (profile.email ?? "").slice(0, 320),
    ...(profile.picture && profile.picture.length <= 2000 ? { avatarUrl: profile.picture } : {}),
  };
  const existing = await findUserByProvider(p, profile.subject);
  if (existing) return (await updateUserProfile(existing._id, fields)) ?? existing;
  const hash = createHash("sha256").update(profile.subject).digest()[0]!;
  const user: UserDoc = { _id: newId(), ...fields, provider: p, providerSubject: profile.subject, color: PALETTE[hash % PALETTE.length]!, createdAt: new Date() };
  try {
    await insertUser(user);
    return user;
  } catch (err) {
    // Two first logins at once: the other request created the User.
    const raced = isDuplicateKeyError(err) ? await findUserByProvider(p, profile.subject) : null;
    if (!raced) throw err;
    return raced;
  }
}

/** Logout — ends every session of this User on the server. */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await bumpVersion(userId);
}
