/** Request schemas for Places, Tags and Areas (API.md A7, A8, B15–B23). */
import { z } from "zod";
import { Id, Satang } from "./common.js";
import { PlaceType } from "./models.js";

/** Collapse whitespace and trim, then require 1..max characters. */
export const label = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(max));

/** Free-text Area; blank means "ไม่ระบุย่าน" (null). */
const Area = z
  .string()
  .max(100)
  .transform((s) => s.replace(/\s+/g, " ").trim() || null)
  .nullable();

/** Tag name as typed: a leading "#" is dropped. */
export const TagName = z
  .string()
  .transform((s) => s.replace(/^#+/, "").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(50));

/** Google Maps link: stored as a plain string, never fetched. */
const MapUrl = z.url({ protocol: /^https?$/ }).max(2000);

export const PlaceCreateBody = z.strictObject({
  name: label(200),
  type: PlaceType,
  city: label(100),
  area: Area.default(null),
  tagIds: z.array(Id).max(30).default([]),
  /** Tag names typed in the form; matched to existing tags by name, the rest are created for the User. */
  newTags: z.array(TagName).max(30).default([]),
  mapUrl: MapUrl.optional(),
  note: z.string().max(2000).default(""),
  costPerPerson: Satang.optional(),
});

/** PATCH: every field optional; `null` removes `mapUrl` / `costPerPerson`. */
export const PlaceUpdateBody = z.strictObject({
  name: label(200).optional(),
  type: PlaceType.optional(),
  city: label(100).optional(),
  area: Area.optional(),
  tagIds: z.array(Id).max(30).optional(),
  newTags: z.array(TagName).max(30).optional(),
  mapUrl: MapUrl.nullable().optional(),
  note: z.string().max(2000).optional(),
  costPerPerson: Satang.nullable().optional(),
});

const commaList = z
  .string()
  .transform((s) => [...new Set(s.split(",").map((t) => t.trim()).filter(Boolean))]);

export const PlaceListQuery = z.object({
  city: z.string().min(1).optional(),
  area: z.string().min(1).optional(),
  /** Tag ids, comma separated; a Place matches if it has any of them. */
  tags: commaList.optional(),
  unscheduled: z.enum(["0", "1"]).optional(),
  group: z.enum(["area", "type"]).optional(),
});

export const AreaRenameBody = z.strictObject({
  city: label(100),
  from: label(100),
  /** Blank = move the Places to "ไม่ระบุย่าน". */
  to: Area,
});

export const TagCreateBody = z.strictObject({
  name: TagName,
  group: label(50).nullable().default(null),
});

export const TagUpdateBody = z.strictObject({
  name: TagName.optional(),
  group: label(50).nullable().optional(),
});

export const TagSuggestQuery = z.object({
  q: z.string().max(50).optional(),
});

export type PlaceCreateBody = z.infer<typeof PlaceCreateBody>;
export type PlaceUpdateBody = z.infer<typeof PlaceUpdateBody>;
