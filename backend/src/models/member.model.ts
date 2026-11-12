import { collections } from "../db/collections.js";
import type { MemberDoc } from "../schemas/models.js";

/**
 * Filter for "the active Member this User is in this Trip". `$type: 'string'` makes the
 * predicate imply the partial filter of `members_user_trip`, so the planner can use it.
 */
export function activeMemberFilter(userId: string, tripId: string) {
  return { userId: { $eq: userId, $type: "string" as const }, tripId, status: "active" as const };
}

export function findActiveMember(userId: string, tripId: string): Promise<MemberDoc | null> {
  return collections.members().findOne(activeMemberFilter(userId, tripId));
}

/** Active memberships of a User across trips (A2). Same partial-index shape, without `tripId`. */
export function findActiveMembershipsOfUser(userId: string): Promise<MemberDoc[]> {
  return collections
    .members()
    .find({ userId: { $eq: userId, $type: "string" as const }, status: "active" as const })
    .toArray();
}

/** Members shown in the trip (everyone except soft-removed ones). */
export function listTripMembers(tripId: string): Promise<MemberDoc[]> {
  return collections
    .members()
    .find({ tripId, status: { $ne: "removed" } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
}

export function findTripMember(tripId: string, memberId: string): Promise<MemberDoc | null> {
  return collections.members().findOne({ _id: memberId, tripId, status: { $ne: "removed" } });
}

/** Only `active` Members can pay, receive, or be assigned work; `pending` ones are not in the trip yet. */
export function findActiveTripMember(tripId: string, memberId: string): Promise<MemberDoc | null> {
  return collections.members().findOne({ _id: memberId, tripId, status: "active" });
}

export async function insertMembers(members: MemberDoc[]): Promise<void> {
  if (members.length > 0) await collections.members().insertMany(members);
}

export function countActiveOwners(tripId: string): Promise<number> {
  return collections.members().countDocuments({ tripId, role: "owner", status: "active" });
}

export function setMemberRole(tripId: string, memberId: string, role: MemberDoc["role"]): Promise<MemberDoc | null> {
  return collections
    .members()
    .findOneAndUpdate({ _id: memberId, tripId, status: { $ne: "removed" } }, { $set: { role } }, { returnDocument: "after" });
}

/** Soft remove: the Member disappears from the trip but old Expenses still show the name. */
export async function softRemoveMember(tripId: string, memberId: string): Promise<boolean> {
  const r = await collections.members().updateOne({ _id: memberId, tripId, status: { $ne: "removed" } }, { $set: { status: "removed" } });
  return r.modifiedCount === 1;
}

export async function deleteMember(tripId: string, memberId: string): Promise<boolean> {
  const r = await collections.members().deleteOne({ _id: memberId, tripId });
  return r.deletedCount === 1;
}

/**
 * Claim: link a User to an Unclaimed Member in one conditional update (`userId: null` in the
 * filter), so two people claiming the same name at once cannot both win. Returns null when
 * nothing matched; throws E11000 when the User is already a Member of the trip.
 */
export function claimMember(
  tripId: string,
  memberId: string,
  user: { _id: string; provider: MemberDoc["joinedVia"] },
  status: "active" | "pending",
): Promise<MemberDoc | null> {
  return collections.members().findOneAndUpdate(
    { _id: memberId, tripId, userId: null, status: "active" },
    { $set: { userId: user._id, joinedVia: user.provider, claimedAt: new Date(), status } },
    { returnDocument: "after" },
  );
}

/** pending → active. Null when the Member is not pending. */
export function approveMember(tripId: string, memberId: string): Promise<MemberDoc | null> {
  return collections
    .members()
    .findOneAndUpdate({ _id: memberId, tripId, status: "pending" }, { $set: { status: "active" } }, { returnDocument: "after" });
}

export function findMemberAnyStatus(tripId: string, memberId: string): Promise<MemberDoc | null> {
  return collections.members().findOne({ _id: memberId, tripId });
}

/** Unclaimed Members a newcomer can pick on the join page. */
export function listUnclaimedMembers(tripId: string): Promise<MemberDoc[]> {
  return collections.members().find({ tripId, userId: null, status: "active" }).sort({ createdAt: 1, _id: 1 }).toArray();
}

/** Every Member of the trip in any status — balances need them all, since old Expenses may name removed Members. */
export function listAllTripMembers(tripId: string): Promise<MemberDoc[]> {
  return collections.members().find({ tripId }).sort({ createdAt: 1, _id: 1 }).toArray();
}
