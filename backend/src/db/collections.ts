import type { Collection } from "mongodb";
import type {
  ActivityDoc,
  ChecklistItemDoc,
  DocumentDoc,
  ExpenseDoc,
  InviteDoc,
  MemberDoc,
  PlaceDoc,
  PlanItemDoc,
  SettlementDoc,
  TagDoc,
  TripDoc,
  UserDoc,
} from "../schemas/models.js";
import { getDb } from "./client.js";

/** Typed access to every collection; names match docs/db/schema.md. */
export const collections = {
  users: (): Collection<UserDoc> => getDb().collection<UserDoc>("users"),
  trips: (): Collection<TripDoc> => getDb().collection<TripDoc>("trips"),
  members: (): Collection<MemberDoc> => getDb().collection<MemberDoc>("members"),
  invites: (): Collection<InviteDoc> => getDb().collection<InviteDoc>("invites"),
  documents: (): Collection<DocumentDoc> => getDb().collection<DocumentDoc>("documents"),
  places: (): Collection<PlaceDoc> => getDb().collection<PlaceDoc>("places"),
  tags: (): Collection<TagDoc> => getDb().collection<TagDoc>("tags"),
  planItems: (): Collection<PlanItemDoc> => getDb().collection<PlanItemDoc>("planItems"),
  expenses: (): Collection<ExpenseDoc> => getDb().collection<ExpenseDoc>("expenses"),
  settlements: (): Collection<SettlementDoc> => getDb().collection<SettlementDoc>("settlements"),
  checklistItems: (): Collection<ChecklistItemDoc> => getDb().collection<ChecklistItemDoc>("checklistItems"),
  activities: (): Collection<ActivityDoc> => getDb().collection<ActivityDoc>("activities"),
};
