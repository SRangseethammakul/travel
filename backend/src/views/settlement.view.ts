import type { SettlementDoc } from "../schemas/models.js";
import { serialize } from "./serialize.js";

export const settlementView = (doc: SettlementDoc) => serialize(doc);
