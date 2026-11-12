"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { listUsers } from "./queries";
import { MOCK_USER_COOKIE, SESSION_COOKIE } from "./session";

/**
 * Dev-only: switch the signed-in User to one from A17. Also drops `session`,
 * because the backend lets a session win over `mock-user`.
 */
export async function switchMockUser(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  const userId = String(formData.get("userId") ?? "");
  if (!(await listUsers()).some((u) => u.id === userId)) return;
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.set(MOCK_USER_COOKIE, userId, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
