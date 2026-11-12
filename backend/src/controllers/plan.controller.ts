import type { Request, RequestHandler } from "express";
import { currentMember } from "../auth/middleware.js";
import { assertOwnerOrCreator } from "../auth/ownership.js";
import { newId } from "../db/ids.js";
import { sortPlanItems } from "../domain/plan.js";
import { tripDayCount } from "../domain/trip-dates.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import { countPlacesInTrip, findPlace } from "../models/place.model.js";
import { deletePlanItem, findPlanItem, findPlanItems, insertPlanItems, updatePlanItem } from "../models/plan.model.js";
import { documentsExist, expenseExists } from "../models/reference.model.js";
import { findTripById } from "../models/trip.model.js";
import type { PlanItemDoc, TripDoc } from "../schemas/models.js";
import {
  HopBody,
  TransitCreateBody,
  TransitUpdateBody,
  VisitCreateBody,
  VisitUpdateBody,
} from "../schemas/plan.js";
import { planItemView } from "../views/plan.view.js";
import { param } from "./params.js";

const itemNotFound = () => new HttpError(404, "plan_item_not_found", "ไม่พบรายการนี้ในแผนแล้ว");

/** 404 when missing; 403 unless owner or the editor who added it. */
async function ownItem(req: Request): Promise<PlanItemDoc> {
  const me = currentMember(req);
  const item = await findPlanItem(me.tripId, param(req, "itemId"));
  if (!item) throw itemNotFound();
  assertOwnerOrCreator(me, item.createdBy, "คุณแก้หรือลบได้เฉพาะรายการในแผนที่ตัวเองเพิ่ม");
  return item;
}
const bad = (code: string, message: string) => new HttpError(400, code, message);

async function tripOf(req: Request): Promise<TripDoc> {
  const trip = await findTripById(currentMember(req).tripId);
  if (!trip) throw new HttpError(404, "trip_not_found", "ไม่พบทริปนี้");
  return trip;
}

function checkDays(days: number[], trip: TripDoc): void {
  const n = tripDayCount(trip.startDate, trip.endDate);
  if (days.some((d) => d > n)) throw bad("invalid_day", `เลือกวันได้ตั้งแต่วันที่ 1–${n}`);
}

/** Links of a Transit must point at this trip's Documents, Expense and Places. */
async function checkTransitLinks(
  tripId: string,
  t: { departAt?: string; arriveAt?: string; docIds?: string[]; expenseId?: string | null; fromPlaceId?: string | null; toPlaceId?: string | null },
): Promise<void> {
  if (t.departAt && t.arriveAt && t.arriveAt < t.departAt) throw bad("invalid_time", "เวลาถึงต้องไม่ก่อนเวลาออก");
  if (t.docIds && !(await documentsExist(tripId, t.docIds))) throw bad("unknown_document", "ไม่พบเอกสารที่เลือกในทริปนี้");
  if (t.expenseId && !(await expenseExists(tripId, t.expenseId))) throw bad("unknown_expense", "ไม่พบค่าใช้จ่ายที่เลือกในทริปนี้");
  const placeIds = [t.fromPlaceId, t.toPlaceId].filter((id): id is string => !!id);
  if (placeIds.length && (await countPlacesInTrip(tripId, [...new Set(placeIds)])) !== new Set(placeIds).size) {
    throw bad("unknown_place", "ไม่พบสถานที่ที่เลือกในทริปนี้");
  }
}

/** Short name for Activity text: the Place name, or "BKK → HND". */
async function itemLabel(item: PlanItemDoc): Promise<string> {
  if (item.kind === "transit") return `${item.fromCode ?? item.fromText} → ${item.toCode ?? item.toText}`;
  return `"${(await findPlace(item.tripId, item.placeId))?.name ?? "สถานที่"}"`;
}

/** Split a PATCH body into `$set` and `$unset` (`null` = remove; `time: null` is a value for visits). */
function toUpdate(body: Record<string, unknown>, nullable: readonly string[] = []) {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    if (v === null && !nullable.includes(k)) unset.push(k);
    else set[k] = v;
  }
  return { set, unset };
}

/** A10 — day, then time (untimed last), then insertion order. */
export const listPlan: RequestHandler = async (req, res) => {
  const trip = await tripOf(req);
  const items = await findPlanItems(trip._id);
  res.json(sortPlanItems(items, trip.startDate).map(planItemView));
};

/** B24 — editor+. One Place on several days in one call. */
export const addVisits: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const body = VisitCreateBody.parse(req.body);
  const trip = await tripOf(req);
  checkDays(body.days, trip);
  const place = await findPlace(me.tripId, body.placeId);
  if (!place) throw bad("unknown_place", "ไม่พบสถานที่นี้ในทริป");

  const now = Date.now();
  const items: PlanItemDoc[] = [...body.days].sort((a, b) => a - b).map((day, i) => ({
    _id: newId(),
    tripId: me.tripId,
    kind: "place",
    day,
    time: body.time,
    placeId: place._id,
    note: body.note,
    createdBy: me._id,
    createdAt: new Date(now + i), // keeps insertion order within one call
  }));
  await insertPlanItems(items);
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "plan",
    refId: items[0]!._id,
    text: `เพิ่ม "${place.name}" ลงแผนวันที่ ${body.days.join(", ")}${body.time ? ` เวลา ${body.time}` : ""}`,
  });
  res.status(201).json(items.map(planItemView));
};

/** B25 — editor+. */
export const addTransit: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const body = TransitCreateBody.parse(req.body);
  await checkTransitLinks(me.tripId, body);
  const item: PlanItemDoc = { _id: newId(), tripId: me.tripId, kind: "transit", ...body, createdBy: me._id, createdAt: new Date() };
  await insertPlanItems([item]);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: item._id, text: `เพิ่มการเดินทาง ${await itemLabel(item)}` });
  res.status(201).json(planItemView(item));
};

/** B26 — owner, or the editor who added it. Visits take `day` / `time` / `note`; Transits take their own fields. */
export const patchPlanItem: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const existing = await ownItem(req);
  const itemId = existing._id;

  let update: { set: Record<string, unknown>; unset: string[] };
  if (existing.kind === "place") {
    const body = VisitUpdateBody.parse(req.body);
    if (body.day !== undefined) checkDays([body.day], await tripOf(req));
    update = toUpdate(body, ["time"]);
  } else {
    const body = TransitUpdateBody.parse(req.body);
    await checkTransitLinks(me.tripId, {
      ...body,
      departAt: body.departAt ?? existing.departAt,
      arriveAt: body.arriveAt ?? existing.arriveAt,
    });
    update = toUpdate(body);
  }

  const item = await updatePlanItem(me.tripId, itemId, update.set, update.unset);
  if (!item) throw itemNotFound();
  const when = item.kind === "place" ? ` วันที่ ${item.day}${item.time ? ` เวลา ${item.time}` : ""}` : "";
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: item._id, text: `แก้แผน ${await itemLabel(item)}${when}` });
  res.json(planItemView(item));
};

/** B27 — owner, or the editor who added the item. Sets the Hop to the next item. */
export const putHop: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const hop = HopBody.parse(req.body);
  const item = await updatePlanItem(me.tripId, (await ownItem(req))._id, { travelToNext: hop }, []);
  if (!item) throw itemNotFound();
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: item._id, text: `แก้การเดินทางต่อจาก ${await itemLabel(item)}` });
  res.json(planItemView(item));
};

/** B27 — owner, or the editor who added the item. Removes the Hop. */
export const deleteHop: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const item = await updatePlanItem(me.tripId, (await ownItem(req))._id, {}, ["travelToNext"]);
  if (!item) throw itemNotFound();
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: item._id, text: `ลบการเดินทางต่อจาก ${await itemLabel(item)}` });
  res.json(planItemView(item));
};

/** B28 — owner, or the editor who added it. */
export const removePlanItem: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const item = await ownItem(req);
  const label = await itemLabel(item);
  await deletePlanItem(me.tripId, item._id);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: null, text: `ลบ ${label} ออกจากแผน` });
  res.status(204).end();
};
