/** Request schemas for Personal Expenses (API.md B44–B47). */
import { z } from "zod";
import { IsoDate, PositiveSatang, text } from "./common.js";
import { PersonalExpenseDoc } from "./models.js";
import { label } from "./places.js";

/** B45 — `ownerId`, `currency` and `baseAmount` are set by the server. */
export const PersonalExpenseCreateBody = z.strictObject({
  title: label(200),
  category: PersonalExpenseDoc.shape.category,
  amount: PositiveSatang,
  method: PersonalExpenseDoc.shape.method,
  note: text(2000).optional(),
  date: IsoDate,
});

/** B46 — any field; `note: null` removes the note. */
export const PersonalExpenseUpdateBody = z
  .strictObject({
    title: label(200).optional(),
    category: PersonalExpenseDoc.shape.category.optional(),
    amount: PositiveSatang.optional(),
    method: PersonalExpenseDoc.shape.method.optional(),
    note: text(2000).nullable().optional(),
    date: IsoDate.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "ไม่มีข้อมูลที่จะแก้ไข" });
