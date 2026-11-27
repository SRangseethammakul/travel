/**
 * Data model from docs/design/SPEC.md "โมเดลข้อมูลที่แนะนำ" (+ User).
 * Names follow CONTEXT.md. Money is always integer satang; dates are ISO strings.
 */
import type { Satang } from "@/lib/money/format";
import type { ISODate } from "@/lib/date";

export type ID = string;
/** "2026-12-12T00:30" — local wall-clock time at the place it happens (timezones are an open SPEC item). */
export type LocalDateTime = string;
/** Full ISO timestamp, e.g. "2026-11-11T14:58:00.000Z". */
export type Timestamp = string;

/** Colour keys map to design tokens (see components/ui/colors.ts). Never raw hex in data. */
export type ColorKey = "teal" | "blue" | "orange" | "purple" | "slate" | "gray" | "ink";

// ── People ──────────────────────────────────────────────────────────────────

export type AuthProvider = "line" | "google";

/** A real person's account (LINE or Google). One User can be a Member of many Trips. */
export interface User {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: AuthProvider;
  color: ColorKey;
}

export type Role = "owner" | "editor" | "viewer";

/** A named participant in one Trip. `userId: null` = Unclaimed Member. */
export interface Member {
  id: ID;
  tripId: ID;
  userId: ID | null;
  displayName: string;
  role: Role;
  joinedVia?: AuthProvider;
  color: ColorKey;
  /** Provider picture of the linked User; absent for Unclaimed Members. */
  avatarUrl?: string;
  /** A4 lists `pending` Members (waiting for the owner's approval) next to `active` ones; absent = active. */
  status?: "active" | "pending" | "removed";
}

// ── Trip ────────────────────────────────────────────────────────────────────

/** One part of a multi-city Trip's route, in trip days (1-based, inclusive). */
export interface CityLeg {
  city: string;
  from: number;
  to: number;
}

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  budget: Satang | null;
  baseCurrency: "THB";
  cover: ColorKey;
  legs?: CityLeg[];
  /** Free-text meeting point shown on the trip page, e.g. "สุวรรณภูมิ · ศ. 11 ธ.ค. 21:30". */
  meetingPoint?: string;
  createdBy: ID; // User id
}

/** One row of A2 GET /api/trips: a trip, my Member in it, and my Outstanding there. */
export interface MyTrip {
  trip: Trip;
  me: Member;
  outstanding: Satang;
}

/** How long a new or reset invite link works (B7 `expiresIn`). */
export type InviteExpiry = "1d" | "7d" | "never";

export interface Invite {
  tripId: ID;
  token: string;
  expiresAt: Timestamp | null;
  requireApproval: boolean;
}

/** Stored privately; opened through a signed URL. */
export interface TripDocument {
  id: ID;
  tripId: ID;
  name: string;
  /** Storage key; only test fixtures set it — the backend never sends it (files open through B13 signed URLs). */
  fileKey?: string;
  mime: string;
  size: number; // bytes
  uploadedBy: ID; // Member id
}

// ── Places and plans ────────────────────────────────────────────────────────

export type PlaceType = "sight" | "food" | "interest" | "stay" | "transit";

export interface Place {
  id: ID;
  tripId: ID;
  name: string;
  type: PlaceType;
  city: string;
  /** Area typed by a Member, or null for "ไม่ระบุย่าน". */
  area: string | null;
  tagIds: ID[];
  mapUrl?: string;
  note: string;
  costPerPerson?: Satang;
  /** Hotel details; only on type "stay". */
  stay?: PlaceStay;
  createdBy: ID; // Member id
  /** Photos, oldest first ([] when none, max 10). Each `url` is signed and expires (see PlacePhoto). */
  photos: PlacePhoto[];
}

export type PlacePhotoMime = "image/jpeg" | "image/png" | "image/webp" | "image/heic";

export interface PlacePhoto {
  id: ID;
  mime: PlacePhotoMime;
  size: number; // bytes
  uploadedBy: ID; // Member id
  createdAt: string; // ISO
  /** Signed link, usable as <img src> with no cookie. Same-origin path for the local driver, absolute for S3. */
  url: string;
  /** ISO; about 15 minutes after the response. Re-fetch the Place for fresh links. */
  urlExpiresAt: string;
}

export interface PlaceStay {
  checkIn: string; // YYYY-MM-DD, within trip dates
  checkOut: string; // YYYY-MM-DD, after checkIn
  /** "HH:mm"; optional (stays saved before times existed have none). */
  checkInTime?: string;
  checkOutTime?: string;
  /** Total for the whole stay. */
  price?: Satang;
  bookingRef?: string;
  address?: string;
  /** Expense (same trip) that records this stay's price. PATCH replaces `stay` whole, so omit it to unlink. */
  expenseId?: ID;
}

/** Owned by a User and reusable across all their Trips. */
export interface Tag {
  id: ID;
  ownerId: ID; // User id
  name: string;
  group: string | null;
  color?: ColorKey;
}

export type HopMode = "walk" | "train" | "bus" | "taxi" | "car";

/** How people get from one Plan Item to the next on the same day. */
export interface Hop {
  mode: HopMode;
  minutes?: number;
  note?: string;
}

export interface PlacePlanItem {
  kind: "place";
  id: ID;
  tripId: ID;
  day: number; // 1-based trip day
  /** "11:00", or null when not timed yet. */
  time: string | null;
  placeId: ID;
  note: string;
  travelToNext?: Hop;
  /** Member who added it; editors may change only their own (incl. its Hop). */
  createdBy: ID;
}

export type TransitMode = "plane" | "train" | "bus" | "car" | "boat" | "walk" | "other";

export interface TransitPlanItem {
  kind: "transit";
  id: ID;
  tripId: ID;
  mode: TransitMode;
  /** Short code shown large, e.g. "BKK". */
  fromCode?: string;
  fromText: string;
  toCode?: string;
  toText: string;
  departAt: LocalDateTime;
  arriveAt: LocalDateTime;
  /** Entered by the user because departAt/arriveAt may be in different timezones. */
  durationMinutes?: number;
  bookingRef?: string;
  seatInfo?: string;
  docIds: ID[];
  expenseId?: ID;
  /** Places this transit starts/ends at (e.g. the airport), so they count as scheduled. */
  fromPlaceId?: ID;
  toPlaceId?: ID;
  travelToNext?: Hop;
  /** Member who added it; editors may change only their own (incl. its Hop). */
  createdBy: ID;
}

export type PlanItem = PlacePlanItem | TransitPlanItem;

// ── Money ───────────────────────────────────────────────────────────────────

export type ExpenseCategory = "stay" | "transport" | "food" | "activity" | "other";
export type PaymentMethod = "cash" | "promptpay" | "card" | "wallet";
export type SplitMode = "equal" | "amount" | "shares";

/** A Member's portion of an Expense. `amount` is always resolved; `weight` only for shares mode. */
export interface Share {
  memberId: ID;
  amount: Satang;
  weight?: number;
}

export interface Expense {
  id: ID;
  tripId: ID;
  title: string;
  category: ExpenseCategory;
  payerId: ID; // Member id
  method: PaymentMethod;
  /** Legacy: old Expenses only. New input uses `cardName`. */
  cardLast4?: string;
  /** Card name, e.g. "UOB PRVI" (only when method is card). */
  cardName?: string;
  amount: Satang;
  currency: "THB";
  baseAmount: Satang;
  splitMode: SplitMode;
  shares: Share[];
  slipDocId?: ID;
  note?: string;
  /** Day the expense happened (groups the Expenses list). */
  date: ISODate;
  createdBy: ID; // Member id
  createdAt: Timestamp;
  updatedBy?: ID;
  updatedAt?: Timestamp;
}

/** Personal Expenses add "shopping" to the group categories. */
export type PersonalExpenseCategory = ExpenseCategory | "shopping";

/**
 * Money one Member spent only for themself (B44–B47). Only its owner sees it;
 * it has no payer or Shares and never touches group totals or balances.
 */
export interface PersonalExpense {
  id: ID;
  tripId: ID;
  ownerId: ID; // Member id
  title: string;
  category: PersonalExpenseCategory;
  amount: Satang;
  currency: "THB";
  baseAmount: Satang;
  method: PaymentMethod;
  cardName?: string;
  note?: string;
  date: ISODate;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type SettlementStatus = "pending" | "sent" | "confirmed";

export interface Settlement {
  id: ID;
  tripId: ID;
  fromId: ID; // Member id
  toId: ID; // Member id
  amount: Satang;
  status: SettlementStatus;
  slipDocId?: ID;
  createdAt: Timestamp;
  sentAt?: Timestamp;
  confirmedAt?: Timestamp;
}

// ── Checklist and activity ──────────────────────────────────────────────────

export type ChecklistScope = "group" | "personal";

export interface ChecklistItem {
  id: ID;
  tripId: ID;
  scope: ChecklistScope;
  /** Member id; required for personal items (only the owner may see them). */
  ownerId?: ID;
  text: string;
  category: string;
  assigneeId?: ID;
  done: boolean;
  doneBy?: ID;
  fromTemplate: boolean;
}

export type ActivityType = "expense" | "settlement" | "plan" | "member";

export interface Activity {
  id: ID;
  tripId: ID;
  actorId: ID; // Member id
  type: ActivityType;
  refId: ID | null;
  text: string;
  createdAt: Timestamp;
  /** User ids that have read it. */
  readBy: ID[];
}

// ── Derived (computed, never stored) ────────────────────────────────────────

export interface MemberBalanceRow {
  member: Member;
  paid: Satang;
  share: Satang;
  net: Satang;
  outstanding: Satang;
}

export interface TripBalances {
  total: Satang;
  rows: MemberBalanceRow[];
  transfers: { from: Member; to: Member; amount: Satang; settlement: Settlement | null }[];
}

// ── Admin (docs/design/SPEC.md "ผู้ดูแลระบบ"; /api/admin/*) ─────────────────────

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUserRow {
  id: ID;
  name: string;
  email: string;
  provider: AuthProvider;
  color: ColorKey;
  avatarUrl?: string;
  tripCount: number;
  createdAt: Timestamp;
  lastSeenAt: Timestamp | null;
}

export type AdminTripStatus = "upcoming" | "ongoing" | "past";

export interface AdminTripOwner {
  memberId: ID;
  name: string;
  userId: ID | null;
}

export interface AdminTripRow {
  id: ID;
  name: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  cover: ColorKey;
  status: AdminTripStatus;
  owners: AdminTripOwner[];
  memberCount: number;
  /** Satang; Expenses only, never personal expenses. */
  spent: Satang;
}

export interface AdminDelta {
  current: number;
  previous: number;
}

export interface AdminOverview {
  totals: { users: number; trips: number };
  kpis: { usersNew: AdminDelta; tripsNew: AdminDelta; activeTrips7d: AdminDelta; signups7d: AdminDelta };
  daily: { date: string; users: number; trips: number }[];
  providers: { google: number; line: number };
  usersInTripPct: number;
  avgMembersPerTrip: number;
  recentUsers: AdminUserRow[];
  busiestTrips: (AdminTripRow & { activity7d: number })[];
}

export interface AdminUserDetail {
  user: AdminUserRow & { sessionVersion: number };
  trips: { id: ID; name: string; startDate: ISODate; endDate: ISODate; cover: ColorKey; status: AdminTripStatus; memberCount: number; role: Role }[];
  activity: { id: ID; tripId: ID; tripName: string; type: ActivityType; text: string; createdAt: Timestamp }[];
}

export interface AdminTripDetail {
  trip: AdminTripRow & { createdBy: { id: ID; name: string } | null };
  members: { id: ID; displayName: string; role: Role; userId: ID | null; color: ColorKey; status: string }[];
  counts: { places: number; planItems: number; expenses: number; settlements: number; checklistItems: number; activity7d: number };
  activity: { id: ID; actorName: string; type: ActivityType; text: string; createdAt: Timestamp }[];
}

export interface AdminRequestLog {
  id: ID;
  at: Timestamp;
  method: string;
  path: string;
  status: number;
  ms: number;
  userId: ID | null;
}

export interface AdminSystem {
  api: { uptimeSec: number; p95Ms1h: number };
  mongo: { ok: boolean; pingMs: number; collections: number };
  storage: { driver: string };
  rateLimit: { blocked24h: number };
  errorsByHour: { hour: string; c4xx: number; c5xx: number; total: number }[];
  logs: AdminPage<AdminRequestLog>;
}
