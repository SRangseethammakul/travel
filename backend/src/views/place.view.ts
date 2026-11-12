import type { PlaceDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const placeView = (doc: PlaceDoc) => serialize(doc);

/**
 * Places grouped by Area or by type, in first-seen order, e.g. "Shinjuku · 4 ที่ · ลงแผน 3".
 * `key` is the Area (null = "ไม่ระบุย่าน") or the PlaceType.
 */
export function placeGroupsView(places: PlaceDoc[], by: "area" | "type", scheduled: ReadonlySet<string>) {
  const groups = new Map<string | null, PlaceDoc[]>();
  for (const p of places) {
    const key = by === "area" ? p.area : p.type;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups].map(([key, list]) => ({
    key,
    count: list.length,
    scheduled: list.filter((p) => scheduled.has(p._id)).length,
    places: list.map(placeView),
  }));
}
