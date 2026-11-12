import { collections } from "../db/collections.js";
import type { InviteDoc } from "../schemas/models.js";

export function findInviteByTrip(tripId: string): Promise<InviteDoc | null> {
  return collections.invites().findOne({ _id: tripId });
}

export function findInviteByToken(token: string): Promise<InviteDoc | null> {
  return collections.invites().findOne({ token });
}

/** Create or change the trip's invite. The token is only set when the invite is new. */
export function upsertInvite(
  tripId: string,
  settings: Pick<InviteDoc, "expiresAt" | "requireApproval">,
  newToken: string,
): Promise<InviteDoc | null> {
  return collections.invites().findOneAndUpdate(
    { _id: tripId },
    { $set: { ...settings, tripId, updatedAt: new Date() }, $setOnInsert: { token: newToken } },
    { upsert: true, returnDocument: "after" },
  );
}

/** New token, old link stops working. Null when the trip has no invite yet. */
export function resetInviteToken(tripId: string, token: string): Promise<InviteDoc | null> {
  return collections.invites().findOneAndUpdate({ _id: tripId }, { $set: { token, updatedAt: new Date() } }, { returnDocument: "after" });
}
