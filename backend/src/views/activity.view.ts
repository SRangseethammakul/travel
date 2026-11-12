import type { ActivityDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

/**
 * Activity as in frontend types, plus `action: "confirm_settlement"` when the viewer is the
 * receiver of a Settlement that is still `sent` (the "ตรวจและยืนยัน" button, which calls B33).
 */
export const activityView = (doc: ActivityDoc, needsConfirm: boolean) => ({
  ...serialize(doc),
  ...(needsConfirm ? { action: "confirm_settlement" as const } : {}),
});
