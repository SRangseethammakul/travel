import type { RequestHandler } from "express";
import { currentMember, currentUser } from "../auth/middleware.js";
import { AreaRenameBody, PlaceCreateBody, PlaceListQuery, PlaceUpdateBody } from "../schemas/places.js";
import type { PlaceDoc } from "../schemas/models.js";
import * as photos from "../services/place-photo.service.js";
import * as places from "../services/place.service.js";
import { placePhotoView, placeGroupsView, placeView } from "../views/place.view.js";
import { param } from "./params.js";

const photoViews = (map: Map<string, photos.SignedPhoto[]>) =>
  new Map([...map].map(([placeId, list]) => [placeId, list.map((p) => placePhotoView(p.photo, p.signed))] as const));

/** The Place as the API returns it, with signed photo URLs. */
async function placeWithPhotos(place: PlaceDoc) {
  return placeView(place, photoViews(await photos.signedPhotosByPlace([place])).get(place._id));
}

/** A7 — filters `city` / `area` / `tags` / `unscheduled=1`; `group=area|type` returns groups instead of a list. */
export const listPlaces: RequestHandler = async (req, res) => {
  const q = PlaceListQuery.parse(req.query);
  const { places: found, scheduled } = await places.list(currentMember(req).tripId, q);
  const views = photoViews(await photos.signedPhotosByPlace(found));
  res.json(q.group ? placeGroupsView(found, q.group, scheduled, views) : found.map((p) => placeView(p, views.get(p._id))));
};

export const getPlace: RequestHandler = async (req, res) => {
  res.json(await placeWithPhotos(await places.get(currentMember(req).tripId, param(req, "placeId"))));
};

/** B15 — editor+. */
export const createPlace: RequestHandler = async (req, res) => {
  const place = await places.create(currentMember(req), currentUser(req), PlaceCreateBody.parse(req.body));
  res.status(201).json(await placeWithPhotos(place));
};

/** B16 — owner, or the editor who added the Place. */
export const patchPlace: RequestHandler = async (req, res) => {
  const placeId = param(req, "placeId");
  const body = PlaceUpdateBody.parse(req.body);
  res.json(await placeWithPhotos(await places.patch(currentMember(req), currentUser(req), placeId, body)));
};

/** B17 — owner, or the editor who added the Place. */
export const removePlace: RequestHandler = async (req, res) => {
  await places.remove(currentMember(req), param(req, "placeId"));
  res.status(204).end();
};

/** B23 — owner only. Rename an Area, or merge it into another, within one city. */
export const patchArea: RequestHandler = async (req, res) => {
  const updatedPlaces = await places.patchArea(currentMember(req), AreaRenameBody.parse(req.body));
  res.json({ updatedPlaces });
};
