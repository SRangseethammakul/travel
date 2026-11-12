import type { TripDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const tripView = (t: TripDoc) => serialize(t);
