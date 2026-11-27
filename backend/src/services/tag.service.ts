/**
 * Tags belong to a User and are reused across trips. Tag routes under /api/me have no trip,
 * so they add no Activity (an Activity always belongs to one trip).
 */
import { isDuplicateKeyError, newId } from "../db/ids.js";
import { HttpError } from "../errors.js";
import { countPlacesPerTag, pullTagFromPlaces, tripTagIds } from "../models/place.model.js";
import { deleteTag, findTag, findTagsByIds, findTagsByOwner, insertTags, updateTag } from "../models/tag.model.js";
import type { TagDoc } from "../schemas/models.js";
import type { TagCreateBody, TagUpdateBody } from "../schemas/places.js";
import type { z } from "zod";

const duplicateName = () => new HttpError(409, "tag_exists", "มี tag ชื่อนี้แล้ว");

/** 404 when missing, 403 when it belongs to someone else. */
async function ownTag(userId: string, tagId: string): Promise<TagDoc> {
  const tag = await findTag(tagId);
  if (!tag) throw new HttpError(404, "tag_not_found", "ไม่พบ tag นี้");
  if (tag.ownerId !== userId) throw new HttpError(403, "forbidden", "แก้ได้เฉพาะ tag ของคุณ");
  return tag;
}

/** A8 — every tag used on a Place of this trip (the Places filter). */
export async function listForTrip(tripId: string): Promise<TagDoc[]> {
  return findTagsByIds(await tripTagIds(tripId));
}

/** B18 — my tags first, then other tags used in this trip; `q` matches part of the name. */
export async function suggest(userId: string, tripId: string, rawQ: string | undefined): Promise<{ mine: TagDoc[]; others: TagDoc[] }> {
  const q = (rawQ ?? "").trim().toLowerCase();
  const [mine, inTrip] = await Promise.all([findTagsByOwner(userId), tripTagIds(tripId).then(findTagsByIds)]);
  const match = (t: TagDoc) => t.name.toLowerCase().includes(q);
  return { mine: mine.filter(match), others: inTrip.filter((t) => t.ownerId !== userId && match(t)) };
}

/** A9 */
export function listMine(userId: string): Promise<TagDoc[]> {
  return findTagsByOwner(userId);
}

/** Places (in any trip) per tag of mine: `{ [tagId]: count }`, for ManageTags and the delete confirmation. */
export async function usage(userId: string) {
  const mine = await findTagsByOwner(userId);
  return countPlacesPerTag(mine.map((t) => t._id));
}

/** B19 */
export async function create(userId: string, body: z.infer<typeof TagCreateBody>): Promise<TagDoc> {
  const tag: TagDoc = { _id: newId(), ownerId: userId, name: body.name, group: body.group, createdAt: new Date() };
  try {
    await insertTags([tag]);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateName();
    throw err;
  }
  return tag;
}

/** B20 — rename or move to a group (`group: null` = no group). */
export async function patch(userId: string, tagId: string, body: z.infer<typeof TagUpdateBody>): Promise<TagDoc> {
  await ownTag(userId, tagId);
  try {
    const tag = await updateTag(tagId, userId, body);
    if (!tag) throw new HttpError(404, "tag_not_found", "ไม่พบ tag นี้");
    return tag;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateName();
    throw err;
  }
}

/** B21 — take the tag off every Place first, then delete it. */
export async function remove(userId: string, tagId: string): Promise<number> {
  await ownTag(userId, tagId);
  const removedFromPlaces = await pullTagFromPlaces(tagId);
  await deleteTag(tagId, userId);
  return removedFromPlaces;
}
