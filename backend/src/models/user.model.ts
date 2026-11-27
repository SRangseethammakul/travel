import { collections } from "../db/collections.js";
import type { UserDoc } from "../schemas/models.js";

export function findUserById(userId: string): Promise<UserDoc | null> {
  return collections.users().findOne({ _id: userId });
}

export function listUsers(): Promise<UserDoc[]> {
  return collections.users().find().sort({ createdAt: 1, _id: 1 }).toArray();
}

/** OAuth lookup. `$type: 'string'` lets the planner use the partial index `users_provider_subject`. */
export function findUserByProvider(provider: UserDoc["provider"], subject: string): Promise<UserDoc | null> {
  return collections.users().findOne({ provider, providerSubject: { $eq: subject, $type: "string" as const } });
}

export async function insertUser(user: UserDoc): Promise<void> {
  await collections.users().insertOne(user);
}

/** Logout: every session cookie issued before this stops working (auth/session.ts). */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await collections.users().updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
}

/** Keep name / email / picture in sync with the provider on every login. */
export function updateUserProfile(userId: string, profile: Pick<UserDoc, "name" | "email" | "avatarUrl">): Promise<UserDoc | null> {
  const { avatarUrl, ...rest } = profile;
  return collections.users().findOneAndUpdate(
    { _id: userId },
    avatarUrl ? { $set: { ...rest, avatarUrl } } : { $set: rest, $unset: { avatarUrl: "" } },
    { returnDocument: "after" },
  );
}

/** Sets `lastSeenAt` unless it is already newer than `staleBefore` (the throttle is enforced in the filter, so racing requests write once). */
export async function setLastSeen(userId: string, now: Date, staleBefore: Date): Promise<void> {
  await collections
    .users()
    .updateOne({ _id: userId, $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: staleBefore } }] }, { $set: { lastSeenAt: now } });
}

/** User id → picture, for the Users that have one. Single query, `avatarUrl` only. */
export async function findAvatarsByUserIds(userIds: string[]): Promise<Map<string, string>> {
  const users = await collections
    .users()
    .find({ _id: { $in: userIds }, avatarUrl: { $exists: true } }, { projection: { avatarUrl: 1 } })
    .toArray();
  return new Map(users.flatMap((u) => (u.avatarUrl ? [[u._id, u.avatarUrl] as const] : [])));
}
