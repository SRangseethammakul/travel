import type { TagDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const tagView = (doc: TagDoc) => serialize(doc);
