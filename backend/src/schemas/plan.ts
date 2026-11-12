/** Request schemas for Plan Items and Hops (API.md B24–B28). */
import { z } from "zod";
import { HHmm, Id, LocalDateTime, text } from "./common.js";
import { Hop, TransitPlanItemDoc } from "./models.js";
import { label } from "./places.js";

const Day = z.int().min(1).max(366);

/** One Place on several days at once (PickPlace). */
export const VisitCreateBody = z.strictObject({
  placeId: Id,
  days: z
    .array(Day)
    .min(1)
    .max(60)
    .refine((d) => new Set(d).size === d.length, "days must be unique"),
  time: HHmm.nullable().default(null),
  note: text(2000).default(""),
});

const transitFields = {
  mode: TransitPlanItemDoc.shape.mode,
  fromCode: label(10),
  fromText: label(200),
  toCode: label(10),
  toText: label(200),
  departAt: LocalDateTime,
  arriveAt: LocalDateTime,
  durationMinutes: z.int().min(0).max(10080),
  bookingRef: label(100),
  seatInfo: label(200),
  docIds: z.array(Id).max(20),
  expenseId: Id,
  fromPlaceId: Id,
  toPlaceId: Id,
};

export const TransitCreateBody = z.strictObject({
  mode: transitFields.mode,
  fromCode: transitFields.fromCode.optional(),
  fromText: transitFields.fromText,
  toCode: transitFields.toCode.optional(),
  toText: transitFields.toText,
  departAt: transitFields.departAt,
  arriveAt: transitFields.arriveAt,
  durationMinutes: transitFields.durationMinutes.optional(),
  bookingRef: transitFields.bookingRef.optional(),
  seatInfo: transitFields.seatInfo.optional(),
  docIds: transitFields.docIds.default([]),
  expenseId: transitFields.expenseId.optional(),
  fromPlaceId: transitFields.fromPlaceId.optional(),
  toPlaceId: transitFields.toPlaceId.optional(),
});

/** PATCH of a place Plan Item. */
export const VisitUpdateBody = z.strictObject({
  day: Day.optional(),
  time: HHmm.nullable().optional(),
  note: text(2000).optional(),
});

/** PATCH of a transit Plan Item; `null` removes an optional field. */
export const TransitUpdateBody = z.strictObject({
  mode: transitFields.mode.optional(),
  fromCode: transitFields.fromCode.nullable().optional(),
  fromText: transitFields.fromText.optional(),
  toCode: transitFields.toCode.nullable().optional(),
  toText: transitFields.toText.optional(),
  departAt: transitFields.departAt.optional(),
  arriveAt: transitFields.arriveAt.optional(),
  durationMinutes: transitFields.durationMinutes.nullable().optional(),
  bookingRef: transitFields.bookingRef.nullable().optional(),
  seatInfo: transitFields.seatInfo.nullable().optional(),
  docIds: transitFields.docIds.optional(),
  expenseId: transitFields.expenseId.nullable().optional(),
  fromPlaceId: transitFields.fromPlaceId.nullable().optional(),
  toPlaceId: transitFields.toPlaceId.nullable().optional(),
});

export const HopBody = Hop;

export type TransitCreateBody = z.infer<typeof TransitCreateBody>;
export type TransitUpdateBody = z.infer<typeof TransitUpdateBody>;
