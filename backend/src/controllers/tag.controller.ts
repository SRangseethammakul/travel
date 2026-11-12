/**
 * Tags belong to a User and are reused across trips. Tag routes under /api/me have no trip,
 * so they add no Activity (an Activity always belongs to one trip).
 */
import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { isDuplicateKeyError, newId } from "../db/ids.js";
import { HttpError } from "../errors.js";
import { countPlacesPerTag, pullTagFromPlaces, tripTagIds } from "../models/place.model.js";
import { deleteTag, findTag, findTagsByIds, findTagsByOwner, insertTags, updateTag } from "../models/tag.model.js";
import type { TagDoc } from "../schemas/models.js";
import { TagCreateBody, TagSuggestQuery, TagUpdateBody } from "../schemas/places.js";
import { tagView } from "../views/tag.view.js";
import { param } from "./params.js";

const duplicateName = () => new HttpError(409, "tag_exists", "มี tag ชื่อนี้แล้ว");

/** 404 when missing, 403 when it belongs to someone else. */
async function ownTag(userId: string, tagId: string): Promise<TagDoc> {
  const tag = await findTag(tagId);
  if (!tag) throw new HttpError(404, "tag_not_found", "ไม่พบ tag นี้");
  if (tag.ownerId !== userId) throw new HttpError(403, "forbidden", "แก้ได้เฉพาะ tag ของคุณ");
  return tag;
}

/** A8 — every tag used on a Place of this trip (the Places filter). */
export const listTripTags: RequestHandler = async (req, res) => {
  const tags = await findTagsByIds(await tripTagIds(currentMember(req).tripId));
  res.json(tags.map(tagView));
};

/** B18 — my tags first, then other tags used in this trip; `q` matches part of the name. */
export const suggestTags: RequestHandler = async (req, res) => {
  const userId = currentUser(req)._id;
  const q = (TagSuggestQuery.parse(req.query).q ?? "").trim().toLowerCase();
  const [mine, inTrip] = await Promise.all([findTagsByOwner(userId), tripTagIds(currentMember(req).tripId).then(findTagsByIds)]);
  const match = (t: TagDoc) => t.name.toLowerCase().includes(q);
  res.json({
    mine: mine.filter(match).map(tagView),
    others: inTrip.filter((t) => t.ownerId !== userId && match(t)).map(tagView),
  });
};

/** A9 */
export const listMyTags: RequestHandler = async (req, res) => {
  res.json((await findTagsByOwner(currentUser(req)._id)).map(tagView));
};

/** Places (in any trip) per tag of mine: `{ [tagId]: count }`, for ManageTags and the delete confirmation. */
export const myTagUsage: RequestHandler = async (req, res) => {
  const mine = await findTagsByOwner(currentUser(req)._id);
  res.json(await countPlacesPerTag(mine.map((t) => t._id)));
};

/** B19 */
export const createTag: RequestHandler = async (req, res) => {
  const body = TagCreateBody.parse(req.body);
  const tag: TagDoc = { _id: newId(), ownerId: currentUser(req)._id, name: body.name, group: body.group, createdAt: new Date() };
  try {
    await insertTags([tag]);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateName();
    throw err;
  }
  res.status(201).json(tagView(tag));
};

/** B20 — rename or move to a group (`group: null` = no group). */
export const patchTag: RequestHandler = async (req, res) => {
  const userId = currentUser(req)._id;
  const tagId = param(req, "tagId");
  const body = TagUpdateBody.parse(req.body);
  await ownTag(userId, tagId);
  try {
    const tag = await updateTag(tagId, userId, body);
    if (!tag) throw new HttpError(404, "tag_not_found", "ไม่พบ tag นี้");
    res.json(tagView(tag));
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateName();
    throw err;
  }
};

/** B21 — take the tag off every Place first, then delete it. */
export const removeTag: RequestHandler = async (req, res) => {
  const userId = currentUser(req)._id;
  const tagId = param(req, "tagId");
  await ownTag(userId, tagId);
  const removedFromPlaces = await pullTagFromPlaces(tagId);
  await deleteTag(tagId, userId);
  res.json({ removedFromPlaces });
};
