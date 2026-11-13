import type { PersonalExpenseDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const personalExpenseView = (doc: PersonalExpenseDoc) => serialize(doc);
