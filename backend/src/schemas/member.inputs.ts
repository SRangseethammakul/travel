import { z } from "zod";
import { Id } from "./common.js";
import { Role } from "./models.js";

const displayName = z.string().trim().min(1).max(50);

/** B4 add an Unclaimed Member. */
export const AddMemberInput = z.strictObject({ displayName, role: Role.default("editor") });

/** B5 change role. */
export const ChangeRoleInput = z.strictObject({ role: Role });

/** B7 invite settings. */
export const InviteInput = z.strictObject({
  expiresIn: z.enum(["1d", "7d", "never"]),
  requireApproval: z.boolean(),
});

/** B10 join: claim an Unclaimed Member, or add yourself under a new name. */
export const JoinInput = z.union([z.strictObject({ claimMemberId: Id }), z.strictObject({ displayName })]);
