import type { ExpenseDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const expenseView = (doc: ExpenseDoc) => serialize(doc);
