/** Request schemas for Expenses, Settlements and Activity (API.md A11–A16, B29–B34). */
import { z } from "zod";
import { Id, IsoDate, PositiveSatang, Satang, text } from "./common.js";
import { ActivityDoc, ExpenseDoc } from "./models.js";
import { label } from "./places.js";

/** `equal`: memberId only · `amount`: memberId + amount · `shares`: memberId + weight. The server resolves every amount. */
const ShareInput = z.strictObject({
  memberId: Id,
  amount: Satang.optional(),
  weight: z.int().min(1).max(1000).optional(),
});

const CardLast4 = z.string().regex(/^\d{4}$/);

export const ExpenseCreateBody = z.strictObject({
  title: label(200),
  category: ExpenseDoc.shape.category,
  payerId: Id,
  method: ExpenseDoc.shape.method,
  cardLast4: CardLast4.optional(),
  amount: PositiveSatang,
  splitMode: ExpenseDoc.shape.splitMode,
  shares: z.array(ShareInput).min(1).max(50),
  slipDocId: Id.optional(),
  note: text(2000).optional(),
  date: IsoDate,
});

/** PATCH: any field; `null` removes `cardLast4` / `slipDocId` / `note`. */
export const ExpenseUpdateBody = z.strictObject({
  title: label(200).optional(),
  category: ExpenseDoc.shape.category.optional(),
  payerId: Id.optional(),
  method: ExpenseDoc.shape.method.optional(),
  cardLast4: CardLast4.nullable().optional(),
  amount: PositiveSatang.optional(),
  splitMode: ExpenseDoc.shape.splitMode.optional(),
  shares: z.array(ShareInput).min(1).max(50).optional(),
  slipDocId: Id.nullable().optional(),
  note: text(2000).nullable().optional(),
  date: IsoDate.optional(),
});

/** The sender reports a transfer. Without `amount`, the Suggested Transfer to `toId` is used. */
export const SettlementCreateBody = z.strictObject({
  toId: Id,
  amount: PositiveSatang.optional(),
  slipDocId: Id.optional(),
});

export const SlipBody = z.strictObject({ slipDocId: Id });

export const ActivityQuery = z.object({
  type: ActivityDoc.shape.type.optional(),
  /** Cursor: ISO `createdAt` of the last item already shown (inclusive unless `beforeId` is given). */
  before: z.iso.datetime().optional(),
  /** Optional tie-breaker: `id` of that last item, so the next page starts exactly after it. */
  beforeId: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ActivityReadBody = z.strictObject({ ids: z.array(Id).max(500).default([]) });

export type ExpenseCreateBody = z.infer<typeof ExpenseCreateBody>;
