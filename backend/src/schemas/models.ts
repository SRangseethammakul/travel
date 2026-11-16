/**
 * Stored document shapes (docs/db/schema.md §2) — the source of the TS types for
 * typed collections. Names follow CONTEXT.md. `_id` is a string; timestamps are Date.
 */
import { z } from "zod";
import {
  AuthProvider,
  ColorKey,
  HHmm,
  Id,
  IsoDate,
  LocalDateTime,
  PositiveSatang,
  Satang,
  text,
} from "./common.js";

export const UserDoc = z.strictObject({
  _id: Id,
  name: text(100),
  email: text(320),
  avatarUrl: text(2000).optional(),
  provider: AuthProvider,
  providerSubject: text(200).optional(),
  color: ColorKey,
  /** Bumped by logout; a session cookie carries the version it was issued with. Absent = 0. */
  sessionVersion: z.number().int().min(0).optional(),
  createdAt: z.date(),
});

export const CityLeg = z.strictObject({
  city: text(100),
  from: z.int().min(1),
  to: z.int().min(1),
});

export const TripDoc = z.strictObject({
  _id: Id,
  name: text(100),
  destination: text(100),
  startDate: IsoDate,
  endDate: IsoDate,
  budget: Satang.nullable(),
  baseCurrency: z.literal("THB"),
  cover: ColorKey,
  legs: z.array(CityLeg).max(60).optional(),
  meetingPoint: text(200).optional(),
  createdBy: Id,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const Role = z.enum(["owner", "editor", "viewer"]);
export const MemberStatus = z.enum(["active", "pending", "removed"]);

export const MemberDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  userId: Id.nullable(),
  displayName: text(50),
  role: Role,
  status: MemberStatus,
  joinedVia: AuthProvider.optional(),
  color: ColorKey,
  createdAt: z.date(),
  claimedAt: z.date().optional(),
});

export const InviteDoc = z.strictObject({
  _id: Id, // = tripId
  tripId: Id,
  token: z.string().min(22).max(100),
  expiresAt: z.date().nullable(),
  requireApproval: z.boolean(),
  updatedAt: z.date(),
});

export const DocumentMime = z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"]);

export const DocumentDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  name: text(200),
  fileKey: text(500),
  mime: DocumentMime,
  size: z.int().min(1).max(20_971_520),
  uploadedBy: Id,
  createdAt: z.date(),
});

export const PlaceType = z.enum(["sight", "food", "interest", "stay", "transit"]);

/** Hotel booking details of a Place of type "stay"; dates are trip calendar days. */
export const StayDoc = z
  .strictObject({
    checkIn: IsoDate,
    checkOut: IsoDate,
    price: Satang.optional(),
    bookingRef: text(100).optional(),
    address: text(300).optional(),
    expenseId: Id.optional(),
  })
  .refine((s) => s.checkOut > s.checkIn, { message: "checkOut must be after checkIn", path: ["checkOut"] });

/** A photo attached to a Place; the file lives in object storage under `fileKey`. */
export const PlacePhotoDoc = z.strictObject({
  _id: Id,
  fileKey: text(500),
  mime: z.enum(["image/jpeg", "image/png", "image/heic", "image/webp"]),
  size: z.int().min(1).max(20_971_520),
  uploadedBy: Id,
  createdAt: z.date(),
});

/** At most this many photos on one Place. */
export const MAX_PLACE_PHOTOS = 10;

export const PlaceDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  name: text(200),
  type: PlaceType,
  city: text(100),
  area: text(100).nullable(),
  tagIds: z.array(Id).max(30),
  mapUrl: text(2000).optional(),
  note: text(2000),
  costPerPerson: Satang.optional(),
  stay: StayDoc.optional(),
  /** Absent on Places made before photos existed — read as []. */
  photos: z.array(PlacePhotoDoc).max(MAX_PLACE_PHOTOS).optional(),
  createdBy: Id,
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const TagDoc = z.strictObject({
  _id: Id,
  ownerId: Id,
  name: z.string().min(1).max(50),
  group: text(50).nullable(),
  color: ColorKey.optional(),
  createdAt: z.date(),
});

export const Hop = z.strictObject({
  mode: z.enum(["walk", "train", "bus", "taxi", "car"]),
  minutes: z.int().min(0).max(1440).optional(),
  note: text(500).optional(),
});

export const PlacePlanItemDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  kind: z.literal("place"),
  day: z.int().min(1).max(366),
  time: HHmm.nullable(),
  placeId: Id,
  note: text(2000),
  travelToNext: Hop.optional(),
  /** Member id; an editor may edit or delete only their own Plan Items. */
  createdBy: Id,
  createdAt: z.date(),
});

export const TransitPlanItemDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  kind: z.literal("transit"),
  mode: z.enum(["plane", "train", "bus", "car", "boat", "other"]),
  fromCode: text(10).optional(),
  fromText: text(200),
  toCode: text(10).optional(),
  toText: text(200),
  departAt: LocalDateTime,
  arriveAt: LocalDateTime,
  durationMinutes: z.int().min(0).max(10080).optional(),
  bookingRef: text(100).optional(),
  seatInfo: text(200).optional(),
  docIds: z.array(Id).max(20),
  expenseId: Id.optional(),
  fromPlaceId: Id.optional(),
  toPlaceId: Id.optional(),
  travelToNext: Hop.optional(),
  createdBy: Id,
  createdAt: z.date(),
});

export const PlanItemDoc = z.discriminatedUnion("kind", [PlacePlanItemDoc, TransitPlanItemDoc]);

export const Share = z.strictObject({
  memberId: Id,
  amount: Satang,
  weight: z.int().min(1).max(1000).optional(),
});

export const ExpenseDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  title: text(200),
  category: z.enum(["stay", "transport", "food", "activity", "other"]),
  payerId: Id,
  method: z.enum(["cash", "promptpay", "card", "wallet"]),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  amount: PositiveSatang,
  currency: z.literal("THB"),
  baseAmount: PositiveSatang,
  splitMode: z.enum(["equal", "amount", "shares"]),
  shares: z.array(Share).min(1).max(50),
  slipDocId: Id.optional(),
  note: text(2000).optional(),
  date: IsoDate,
  createdBy: Id,
  createdAt: z.date(),
  updatedBy: Id.optional(),
  updatedAt: z.date().optional(),
});

/** Personal Expense categories: the 5 group ones plus `shopping`. Group Expenses keep only the 5. */
export const PersonalExpenseCategory = z.enum(["stay", "transport", "food", "activity", "other", "shopping"]);

/** Money one Member spent only for themself. Private to `ownerId`; no payer, no Shares. */
export const PersonalExpenseDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  ownerId: Id,
  title: text(200),
  category: PersonalExpenseCategory,
  amount: PositiveSatang,
  currency: z.literal("THB"),
  baseAmount: PositiveSatang,
  method: ExpenseDoc.shape.method,
  note: text(2000).optional(),
  date: IsoDate,
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const SettlementDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  fromId: Id,
  toId: Id,
  amount: PositiveSatang,
  status: z.enum(["pending", "sent", "confirmed"]),
  slipDocId: Id.optional(),
  createdAt: z.date(),
  sentAt: z.date().optional(),
  confirmedAt: z.date().optional(),
});

export const ChecklistItemDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  scope: z.enum(["group", "personal"]),
  ownerId: Id.optional(),
  text: text(300),
  category: text(50),
  assigneeId: Id.optional(),
  done: z.boolean(),
  doneBy: Id.optional(),
  fromTemplate: z.boolean(),
  createdAt: z.date(),
});

export const ActivityDoc = z.strictObject({
  _id: Id,
  tripId: Id,
  actorId: Id,
  type: z.enum(["expense", "settlement", "plan", "member"]),
  refId: Id.nullable(),
  text: text(500),
  createdAt: z.date(),
  readBy: z.array(Id).max(100),
});

export type UserDoc = z.infer<typeof UserDoc>;
export type TripDoc = z.infer<typeof TripDoc>;
export type MemberDoc = z.infer<typeof MemberDoc>;
export type Role = z.infer<typeof Role>;
export type InviteDoc = z.infer<typeof InviteDoc>;
export type DocumentDoc = z.infer<typeof DocumentDoc>;
export type PlacePhotoDoc = z.infer<typeof PlacePhotoDoc>;
export type PlaceDoc = z.infer<typeof PlaceDoc>;
export type TagDoc = z.infer<typeof TagDoc>;
export type PlanItemDoc = z.infer<typeof PlanItemDoc>;
export type ExpenseDoc = z.infer<typeof ExpenseDoc>;
export type PersonalExpenseCategory = z.infer<typeof PersonalExpenseCategory>;
export type PersonalExpenseDoc = z.infer<typeof PersonalExpenseDoc>;
export type SettlementDoc = z.infer<typeof SettlementDoc>;
export type ChecklistItemDoc = z.infer<typeof ChecklistItemDoc>;
export type ActivityDoc = z.infer<typeof ActivityDoc>;
