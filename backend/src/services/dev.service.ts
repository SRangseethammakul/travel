import { HttpError } from "../errors.js";
import { findUserById, listUsers } from "../models/user.model.js";
import type { UserDoc } from "../schemas/models.js";

/** A17 */
export function listAllUsers(): Promise<UserDoc[]> {
  return listUsers();
}

/** B43 — 404 when the User does not exist. */
export async function assertUserExists(userId: string): Promise<void> {
  if (!(await findUserById(userId))) throw new HttpError(404, "user_not_found", "ไม่พบผู้ใช้");
}
