import type { PlanItemDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

/** Serialised per kind so the result stays a discriminated union. */
export const planItemView = (doc: PlanItemDoc) => (doc.kind === "place" ? serialize(doc) : serialize(doc));
