import type { InviteDoc } from "../schemas/models.js";

export function inviteView(i: InviteDoc) {
  return {
    tripId: i.tripId,
    token: i.token,
    expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
    requireApproval: i.requireApproval,
  };
}
