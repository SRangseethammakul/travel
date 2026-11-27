import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { TagCreateBody, TagSuggestQuery, TagUpdateBody } from "../schemas/places.js";
import * as tags from "../services/tag.service.js";
import { tagView } from "../views/tag.view.js";
import { param } from "./params.js";

/** A8 — every tag used on a Place of this trip (the Places filter). */
export const listTripTags: RequestHandler = async (req, res) => {
  res.json((await tags.listForTrip(currentMember(req).tripId)).map(tagView));
};

/** B18 — my tags first, then other tags used in this trip; `q` matches part of the name. */
export const suggestTags: RequestHandler = async (req, res) => {
  const me = currentMember(req);
  const { mine, others } = await tags.suggest(currentUser(req)._id, me.tripId, TagSuggestQuery.parse(req.query).q);
  res.json({ mine: mine.map(tagView), others: others.map(tagView) });
};

/** A9 */
export const listMyTags: RequestHandler = async (req, res) => {
  res.json((await tags.listMine(currentUser(req)._id)).map(tagView));
};

/** Places (in any trip) per tag of mine: `{ [tagId]: count }`. */
export const myTagUsage: RequestHandler = async (req, res) => {
  res.json(await tags.usage(currentUser(req)._id));
};

/** B19 */
export const createTag: RequestHandler = async (req, res) => {
  const tag = await tags.create(currentUser(req)._id, TagCreateBody.parse(req.body));
  res.status(201).json(tagView(tag));
};

/** B20 — rename or move to a group (`group: null` = no group). */
export const patchTag: RequestHandler = async (req, res) => {
  const userId = currentUser(req)._id;
  const tagId = param(req, "tagId");
  const body = TagUpdateBody.parse(req.body);
  res.json(tagView(await tags.patch(userId, tagId, body)));
};

/** B21 — take the tag off every Place first, then delete it. */
export const removeTag: RequestHandler = async (req, res) => {
  const removedFromPlaces = await tags.remove(currentUser(req)._id, param(req, "tagId"));
  res.json({ removedFromPlaces });
};
