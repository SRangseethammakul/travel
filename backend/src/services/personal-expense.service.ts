import { newId } from "../db/ids.js";
import { HttpError } from "../errors.js";
import {
  deletePersonalExpense,
  findPersonalExpense,
  insertPersonalExpense,
  listPersonalExpenses,
  updatePersonalExpense,
} from "../models/personal-expense.model.js";
import { findTripById } from "../models/trip.model.js";
import type { MemberDoc, PersonalExpenseDoc } from "../schemas/models.js";
import type { PersonalExpenseCreateBody, PersonalExpenseUpdateBody } from "../schemas/personal-expense.inputs.js";
import type { z } from "zod";

/*
 * Personal Expenses are private to the Current Member (any role). Another Member's record is 404.
 * They are not Expenses: no Shares, no effect on balances, and no Activity (the feed is shared).
 */

const notFound = () => new HttpError(404, "personal_expense_not_found", "ไม่พบรายการนี้ อาจถูกลบไปแล้ว");

/** 400 unless `date` falls inside the trip (ISO dates compare as strings). */
async function assertDateInTrip(tripId: string, date: string): Promise<void> {
  const trip = await findTripById(tripId);
  if (!trip) throw new HttpError(404, "trip_not_found", "ไม่พบทริปนี้");
  if (date < trip.startDate || date > trip.endDate) throw new HttpError(400, "date_outside_trip", "วันที่ต้องอยู่ในช่วงทริป");
}

/** B44 — my records only. */
export function list(me: MemberDoc): Promise<PersonalExpenseDoc[]> {
  return listPersonalExpenses(me.tripId, me._id);
}

const assertCardNameFitsMethod = (cardName: string | null | undefined, method: string) => {
  if (cardName && method !== "card") throw new HttpError(400, "invalid_card", "ใส่ชื่อบัตรได้เฉพาะการจ่ายด้วยบัตร");
};

/** B45 — any role; owner = me. */
export async function create(me: MemberDoc, body: z.infer<typeof PersonalExpenseCreateBody>): Promise<PersonalExpenseDoc> {
  assertCardNameFitsMethod(body.cardName, body.method);
  await assertDateInTrip(me.tripId, body.date);
  const doc: PersonalExpenseDoc = {
    _id: newId(),
    tripId: me.tripId,
    ownerId: me._id,
    title: body.title,
    category: body.category,
    amount: body.amount,
    currency: "THB",
    baseAmount: body.amount,
    method: body.method,
    ...(body.cardName ? { cardName: body.cardName } : {}),
    ...(body.note !== undefined ? { note: body.note } : {}),
    date: body.date,
    createdAt: new Date(),
  };
  await insertPersonalExpense(doc);
  return doc;
}

/** B46 — only my own record. */
export async function edit(me: MemberDoc, id: string, patch: z.infer<typeof PersonalExpenseUpdateBody>): Promise<PersonalExpenseDoc> {
  if (patch.date !== undefined) await assertDateInTrip(me.tripId, patch.date);
  const existing = await findPersonalExpense(me.tripId, me._id, id);
  if (!existing) throw notFound();
  const method = patch.method ?? existing.method;
  assertCardNameFitsMethod(patch.cardName, method);
  const { note, cardName, ...rest } = patch;
  const $set: Partial<PersonalExpenseDoc> = { ...rest, updatedAt: new Date() };
  if (patch.amount !== undefined) $set.baseAmount = patch.amount;
  if (typeof note === "string") $set.note = note;
  if (typeof cardName === "string") $set.cardName = cardName;
  // `null` removes the card name; so does moving the method away from card.
  const $unset: { note?: ""; cardName?: "" } = {};
  if (note === null) $unset.note = "";
  if (cardName === null || (cardName === undefined && method !== "card")) $unset.cardName = "";
  const updated = await updatePersonalExpense(me.tripId, me._id, existing._id, {
    $set,
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  });
  if (!updated) throw notFound();
  return updated;
}

/** B47 — only my own record. */
export async function remove(me: MemberDoc, id: string): Promise<void> {
  if (!(await deletePersonalExpense(me.tripId, me._id, id))) throw notFound();
}
