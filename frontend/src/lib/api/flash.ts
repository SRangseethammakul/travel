import { cookies } from "next/headers";
import { FLASH_COOKIE, FLASH_MAX_AGE, serializeFlash, type Flash } from "@/lib/flash";

/**
 * Leaves a one-shot message for the next page (the toast in the root layout reads
 * and clears it). Call from a Server Action right before `redirect()` / returning.
 */
export async function flash(message: string, extra: Omit<Flash, "message"> = {}): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, serializeFlash({ message, ...extra }), {
    maxAge: FLASH_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}
