import type { MemberDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

/** Member as in frontend types, plus `status` (pending Members are listed for approval). */
export const memberView = (m: MemberDoc) => serialize(m);
