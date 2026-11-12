import { z } from "zod";
import { Id } from "./common.js";

const text = z.string().trim().min(1).max(300);
const category = z.string().trim().min(1).max(50);
export const ChecklistScope = z.enum(["group", "personal"]);

/** B35 */
export const CreateChecklistInput = z.strictObject({
  scope: ChecklistScope,
  text,
  category,
  assigneeId: Id.optional(),
});

/** B36 — `assigneeId: null` unassigns. */
export const UpdateChecklistInput = z.strictObject({
  done: z.boolean().optional(),
  assigneeId: Id.nullable().optional(),
  text: text.optional(),
  category: category.optional(),
}).refine((o) => Object.keys(o).length > 0, { message: "ไม่มีข้อมูลที่จะแก้ไข" });

/** B38 */
export const SuggestionsQuery = z.object({ scope: ChecklistScope });
