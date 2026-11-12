import { HttpError } from "../errors.js";
import type { MemberDoc } from "../schemas/models.js";

/**
 * Edit/delete rule for things a Member created (Expense, Place, Plan Item): the owner may change
 * everything, an editor only their own (`createdBy` = their Member id), a viewer nothing.
 */
export function assertOwnerOrCreator(me: MemberDoc, createdBy: string, message: string): void {
  if (me.role === "owner" || (me.role === "editor" && createdBy === me._id)) return;
  throw new HttpError(403, "forbidden", message);
}
