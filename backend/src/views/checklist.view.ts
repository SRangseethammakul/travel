import type { ChecklistItemDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const checklistItemView = (c: ChecklistItemDoc) => serialize(c);
