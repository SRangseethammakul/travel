import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { assertOwnerOrCreator } from "../auth/ownership.js";
import { newId } from "../db/ids.js";
import { HttpError } from "../errors.js";
import { addActivity } from "../models/activity.model.js";
import {
  deletePlace,
  findPlace,
  findPlaces,
  insertPlace,
  renameArea,
  tripTagIds,
  updatePlace,
} from "../models/place.model.js";
import { expenseExists } from "../models/reference.model.js";
import { countTransitsAtPlace, deleteVisitsOfPlace, scheduledPlaceIds } from "../models/plan.model.js";
import { findTripById } from "../models/trip.model.js";
import { findTagsByIds, findTagsByOwner, insertTags } from "../models/tag.model.js";
import type { PlaceDoc, TagDoc } from "../schemas/models.js";
import { AreaRenameBody, PlaceCreateBody, PlaceListQuery, PlaceUpdateBody } from "../schemas/places.js";
import { placeGroupsView, placeView } from "../views/place.view.js";
import { param } from "./params.js";

const notYours = "คุณแก้หรือลบได้เฉพาะสถานที่ที่ตัวเองเพิ่ม";
const placeNotFound = () => new HttpError(404, "place_not_found", "ไม่พบสถานที่นี้");

/**
 * Tag ids for a Place: `tagIds` must be the User's own tags or tags already used in the trip;
 * `newTags` names reuse such a tag by name (case-insensitive), otherwise a tag owned by the User is created.
 */
async function resolveTagIds(tripId: string, userId: string, tagIds: string[], newTags: string[]): Promise<string[]> {
  if (!tagIds.length && !newTags.length) return [];
  const [mine, inTrip] = await Promise.all([findTagsByOwner(userId), tripTagIds(tripId).then(findTagsByIds)]);
  const known = new Set([...mine, ...inTrip].map((t) => t._id));
  if (tagIds.some((id) => !known.has(id))) throw new HttpError(400, "unknown_tag", "มี tag ที่ใช้ในทริปนี้ไม่ได้");

  const created: TagDoc[] = [];
  const ids = [...tagIds];
  const byName = (list: TagDoc[], name: string) => list.find((t) => t.name.toLowerCase() === name.toLowerCase());
  for (const name of newTags) {
    const hit = byName(mine, name) ?? byName(inTrip, name) ?? byName(created, name);
    if (hit) ids.push(hit._id);
    else created.push({ _id: newId(), ownerId: userId, name, group: null, createdAt: new Date() });
  }
  const result = [...new Set([...ids, ...created.map((t) => t._id)])];
  if (result.length > 30) throw new HttpError(400, "too_many_tags", "ใส่ tag ได้ไม่เกิน 30 อัน");
  await insertTags(created);
  return result;
}

/** `stay` is only for type "stay" and must fall inside the trip's dates. */
async function assertStayValid(tripId: string, type: PlaceDoc["type"], stay: PlaceDoc["stay"] | null | undefined): Promise<void> {
  if (!stay) return;
  if (type !== "stay") throw new HttpError(400, "stay_wrong_type", "ใส่รายละเอียดที่พักได้เฉพาะสถานที่ประเภทที่พัก");
  const trip = await findTripById(tripId);
  if (trip && (stay.checkIn < trip.startDate || stay.checkOut > trip.endDate)) {
    throw new HttpError(400, "stay_out_of_trip", "วันเช็คอิน/เช็คเอาท์ต้องอยู่ในช่วงวันของทริป");
  }
  if (stay.expenseId && !(await expenseExists(tripId, stay.expenseId))) {
    throw new HttpError(400, "unknown_expense", "ไม่พบค่าใช้จ่ายที่เลือกในทริปนี้");
  }
}

/** A7 — filters `city` / `area` / `tags` / `unscheduled=1`; `group=area|type` returns groups instead of a list. */
export const listPlaces: RequestHandler = async (req, res) => {
  const { tripId } = currentMember(req);
  const q = PlaceListQuery.parse(req.query);
  const scheduled = q.unscheduled === "1" || q.group ? await scheduledPlaceIds(tripId) : new Set<string>();
  const places = await findPlaces(tripId, {
    city: q.city,
    area: q.area,
    tagIds: q.tags,
    excludeIds: q.unscheduled === "1" ? [...scheduled] : undefined,
  });
  res.json(q.group ? placeGroupsView(places, q.group, scheduled) : places.map(placeView));
};

export const getPlace: RequestHandler = async (req, res) => {
  const place = await findPlace(currentMember(req).tripId, param(req, "placeId"));
  if (!place) throw placeNotFound();
  res.json(placeView(place));
};

/** B15 — editor+. */
export const createPlace: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const body = PlaceCreateBody.parse(req.body);
  await assertStayValid(me.tripId, body.type, body.stay);
  const tagIds = await resolveTagIds(me.tripId, currentUser(req)._id, body.tagIds, body.newTags);
  const place: PlaceDoc = {
    _id: newId(),
    tripId: me.tripId,
    name: body.name,
    type: body.type,
    city: body.city,
    area: body.area,
    tagIds,
    ...(body.mapUrl ? { mapUrl: body.mapUrl } : {}),
    note: body.note,
    ...(body.costPerPerson !== undefined ? { costPerPerson: body.costPerPerson } : {}),
    ...(body.stay ? { stay: body.stay } : {}),
    createdBy: me._id,
    createdAt: new Date(),
  };
  await insertPlace(place);
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "plan",
    refId: place._id,
    text: `เพิ่มสถานที่ "${place.name}"${place.area ? ` ใน ${place.area}` : ""}`,
  });
  res.status(201).json(placeView(place));
};

/** B16 — owner, or the editor who added the Place. */
export const patchPlace: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const placeId = param(req, "placeId");
  const body = PlaceUpdateBody.parse(req.body);
  const existing = await findPlace(me.tripId, placeId);
  if (!existing) throw placeNotFound();
  assertOwnerOrCreator(me, existing.createdBy, notYours);

  const { tagIds, newTags, mapUrl, costPerPerson, stay, ...fields } = body;
  const finalType = body.type ?? existing.type;
  await assertStayValid(me.tripId, finalType, stay === undefined ? existing.stay : stay);
  const set: Partial<PlaceDoc> = { ...fields, updatedAt: new Date() };
  const unset: (keyof PlaceDoc)[] = [];
  if (tagIds !== undefined || newTags !== undefined) {
    set.tagIds = await resolveTagIds(me.tripId, currentUser(req)._id, tagIds ?? existing.tagIds, newTags ?? []);
  }
  if (mapUrl === null) unset.push("mapUrl");
  else if (mapUrl !== undefined) set.mapUrl = mapUrl;
  if (costPerPerson === null) unset.push("costPerPerson");
  else if (costPerPerson !== undefined) set.costPerPerson = costPerPerson;
  if (stay === null) unset.push("stay");
  else if (stay !== undefined) set.stay = stay;

  const place = await updatePlace(me.tripId, placeId, set, unset);
  if (!place) throw placeNotFound();
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: place._id, text: `แก้ไขสถานที่ "${place.name}"` });
  res.json(placeView(place));
};

/** B17 — owner, or the editor who added the Place. Removes its visits from the plan; 409 while a Transit starts or ends there. */
export const removePlace: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const placeId = param(req, "placeId");
  const place = await findPlace(me.tripId, placeId);
  if (!place) throw placeNotFound();
  assertOwnerOrCreator(me, place.createdBy, notYours);
  if ((await countTransitsAtPlace(me.tripId, placeId)) > 0) {
    throw new HttpError(409, "place_in_transit", "สถานที่นี้เป็นต้นทางหรือปลายทางของการเดินทาง ลบการเดินทางก่อน");
  }
  await deleteVisitsOfPlace(me.tripId, placeId);
  await deletePlace(me.tripId, placeId);
  await addActivity({ tripId: me.tripId, actorId: me._id, type: "plan", refId: null, text: `ลบสถานที่ "${place.name}"` });
  res.status(204).end();
};

/** B23 — owner only. Rename an Area, or merge it into another, within one city. */
export const patchArea: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const { city, from, to } = AreaRenameBody.parse(req.body);
  const updatedPlaces = await renameArea(me.tripId, city, from, to);
  if (updatedPlaces === 0) throw new HttpError(404, "area_not_found", "ไม่พบย่านนี้แล้ว");
  await addActivity({
    tripId: me.tripId,
    actorId: me._id,
    type: "plan",
    refId: null,
    text: `เปลี่ยนย่าน "${from}" เป็น "${to ?? "ไม่ระบุย่าน"}" ใน ${city}`,
  });
  res.json({ updatedPlaces });
};
