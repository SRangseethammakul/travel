# Travel Planner — MongoDB schema

Status: **design, not implemented**. The `backend` agent implements this in `backend/src/db/` (ช่วง 1 of `first-backend.md`).

Sources, in order of precedence: `docs/design/SPEC.md` → decided agreements in `first-backend.md` / `first-frontend.md` → `frontend/src/lib/api/types.ts` → MongoDB skill advice. Access patterns come from `docs/api/API.md` (A1–A17 reads, B1–B47 writes; B44–B47 are Personal Expenses) and `frontend/src/lib/api/queries.ts`. Terms follow `CONTEXT.md`.

## 0. Conventions

| Topic | Rule | Why |
| --- | --- | --- |
| `_id` | **`string`** in every collection. New documents get `new ObjectId().toHexString()`; seed documents keep readable ids (`act`, `tokyo-winter`, `tokyo-winter:act`). The API maps `_id` → `id`; documents never store a separate `id`. | Frontend ids are strings; the dev `mock-user` cookie holds `act`; seed ids must survive unchanged so `frontend/src/lib/api` can switch without changes. |
| References | Plain `string` ids (`tripId`, `memberId`, `userId`, …). No DBRef. | Same as above. |
| Money | Satang as BSON `int` (validator allows `int` or `long`). zod caps every amount at `2_000_000_000` (฿20M) so the Node driver always writes `int32`. | The Node driver writes a JS integer outside int32 range as `double`, which the validator rejects. A cap keeps money exact and validated. |
| Calendar dates | `string` `YYYY-MM-DD` (`Trip.startDate`, `Expense.date`). | Matches `ISODate` in types; sorts correctly as a string; no timezone shift. |
| Local times | `string` `HH:mm` (`PlanItem.time`), `YYYY-MM-DDTHH:mm` (`departAt`, `arriveAt`). | Local wall-clock time (timezones are an open SPEC item). |
| Timestamps | BSON **`date`** (`createdAt`, `updatedAt`, `sentAt`, `confirmedAt`, `expiresAt`). The API serialises to ISO strings. | Real instants; can be used by TTL/range queries. |
| Optional fields | Omit the field when absent. `null` only where the type says `X \| null` (`Trip.budget`, `Member.userId`, `Place.area`, `Tag.group`, `PlanItem.time`, `Activity.refId`, `Invite.expiresAt`). | Matches `types.ts`; keeps validators simple. |
| Trip scope | Every trip-owned collection has `tripId`, and it is the leading key of that collection's indexes. | Almost every query is "inside one trip". |

## 1. Access patterns

Frequency: **H** = every page view of that screen · **M** = per user action · **L** = rare / admin.

| # | Screen / endpoint | Op | Freq | Collections | Index used |
| --- | --- | --- | --- | --- | --- |
| auth | every `/api/trips/:tripId/**` — Current Member + role | read | H | members | `members_user_trip` (unique partial) |
| A1 | `GET /api/me` | read | H | users | `_id` |
| A2 | `GET /api/trips` (my trips + my Outstanding) | read | H | members → trips → expenses, settlements (per trip) | `members_user_trip` (prefix `userId`), trips `_id`, `expenses_trip_date`, `settlements_trip` |
| A3 | `GET /api/trips/:tripId` | read | H | trips, members | `_id`, `members_user_trip` |
| A4 | `GET /api/trips/:tripId/members` | read | H | members | `members_trip` |
| A5 | `GET /api/trips/:tripId/invite` | read | L | invites | `_id` (= tripId) |
| A6 | `GET .../documents` | read | M | documents | `documents_trip` |
| A7 | `GET .../places` (+ `city` / `area` / `tags` / `unscheduled` filters) | read | H | places (+ planItems for `unscheduled`) | `places_trip_city_area` |
| A8 | `GET .../tags` — tags used in trip | read | H | places (`distinct tagIds`) → tags | `places_trip_city_area` prefix, tags `_id` |
| A9 | `GET /api/me/tags` | read | M | tags | `tags_owner_name` (prefix) |
| A10 | `GET .../plan` | read | H | planItems | `planItems_trip_day_time` (prefix `tripId`); final sort in app |
| A11 | `GET .../expenses` sorted by date, createdAt | read | H | expenses | `expenses_trip_date` (equality + sort) |
| A12 | `GET .../expenses/:id` | read | M | expenses | `_id` (+ `tripId` in filter) |
| A13 | `GET .../settlements` | read | H | settlements | `settlements_trip` |
| A14 | `GET .../balances` | read | H | members, expenses, settlements | `members_trip`, `expenses_trip_date`, `settlements_trip` |
| A15 | `GET .../checklist` (group + my personal) | read | H | checklistItems | `checklist_trip_scope_owner` |
| A16 | `GET .../activity?type=` newest first, paginated | read | H | activities | `activities_trip_created` / `activities_trip_type_created` |
| A17 | `GET /api/dev/users` | read | L | users | collection scan (5 docs, dev only) |
| B1 | create trip (+ owner Member + Unclaimed Members) | insert | L | trips, members, activities | — |
| B2 | patch trip (incl. `legs`, `meetingPoint`) | update | L | trips | `_id` |
| B3 | delete trip | delete | L | all trip-scoped | every `*_trip*` index |
| B4–B6 | add / change role / remove Member | write | L | members (+ expenses, settlements for B6 checks) | `_id`, `members_trip`, `expenses_trip_date` |
| B7–B8 | set / reset invite | upsert | L | invites | `_id` |
| B9 | `GET /api/join/:token` (public) | read | L | invites → trips, members, expenses | `invites_token` (unique), `members_trip`, `expenses_trip_date` |
| B10 | join / Claim | update or insert | L | members, activities | `_id`, `members_user_trip` (uniqueness) |
| B11 | approve pending Member | update | L | members | `_id` |
| B12–B14 | upload / signed URL / delete document | write | M | documents (+ planItems, expenses, settlements on delete) | `_id`, `*_trip*` prefix |
| B15–B17 | place CRUD | write | M | places (+ planItems on delete) | `_id`, `planItems_trip_day_time` prefix |
| B18 | tag suggest `?q=` | read | M | tags (mine) + places/tags (trip) | `tags_owner_name`, `places_trip_city_area` |
| B19–B20 | create / edit tag | write | M | tags | `tags_owner_name` (unique) |
| B21 | delete tag → pull from every Place in every trip | update many + delete | L | places, tags | **`places_tagIds`** (multikey, not trip-prefixed) |
| B22 | tag usage count | count | L | places | `places_tagIds` |
| B23 | rename / merge Area | update many | L | places | `places_trip_city_area` |
| B24–B28 | plan item CRUD, Hop | write | M | planItems | `_id`, `planItems_trip_day_time` |
| B29–B31 | expense CRUD | write | M | expenses (+ planItems.expenseId on delete) | `_id` |
| B32–B34 | report / confirm / re-slip settlement | insert / conditional update | M | settlements | `_id` (+ status in filter) |
| B35–B37 | checklist CRUD | write | M | checklistItems | `_id` |
| B38 | checklist suggestions | — | L | none (static list in code) | — |
| B39 | mark activity read | update many | M | activities | `activities_trip_created` prefix |
| B41 | OAuth callback: find or create User | read/upsert | L | users | `users_provider_subject` (unique partial) |
| B44 | `GET .../personal-expenses` — my Personal Expenses, by date | read | H (personal view of the expenses tab) | personalExpenses | `personalExpenses_trip_owner_date` (equality `tripId`+`ownerId` + full sort) |
| B45–B47 | create / edit / delete my Personal Expense | write | M | personalExpenses (+ trips for the date check) | `_id` (+ `tripId`, `ownerId` in filter) |
| all writes | append Activity | insert | M | activities | — |

## 2. Collections

Fourteen collections: `users`, `trips`, `members`, `invites`, `documents`, `places`, `tags`, `planItems`, `expenses`, `settlements`, `checklistItems`, `activities`, `personalExpenses`, `requestLogs` (capped, admin dashboard).

Sizes are per trip, from `frontend/src/lib/mock/seed.ts` (Tokyo: 4 Members, 12 Places, ~4 days of plan, 5 Expenses, 2 Settlements) scaled to a realistic upper bound for a group trip.

### 2.1 `users`

A real person's account (LINE / Google). Not trip-scoped.

```ts
{
  _id: string;                 // "act" in seed; ObjectId hex for new users
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'line' | 'google';
  providerSubject?: string;    // OAuth `sub` — NEW, needed for B41 find-or-create; absent on seed users
  color: 'teal' | 'blue' | 'orange' | 'purple' | 'slate' | 'gray' | 'ink';
  sessionVersion?: int;        // NEW — logout does $inc; a session cookie must carry the current value. Absent = 0
  lastSeenAt?: Date;           // NEW — set when a session is accepted, at most every 10 minutes (admin dashboard "ใช้ล่าสุด")
  createdAt: Date;
}
```

- No embedded trips or tags: both are many and queried on their own.
- Size: one per person, < 1 KB.

### 2.2 `trips`

```ts
{
  _id: string;
  name: string;
  destination: string;
  startDate: string;           // YYYY-MM-DD
  endDate: string;             // YYYY-MM-DD
  budget: int | null;          // satang
  baseCurrency: 'THB';
  cover: ColorKey;
  legs?: { city: string; from: int; to: int }[];   // EMBEDDED City Legs
  meetingPoint?: string;
  createdBy: string;           // User id
  createdAt: Date;
  updatedAt: Date;
}
```

- **City Legs embedded**: bounded by the number of trip days (validator: max 60), always read with the trip, edited as a whole through B2.
- **Members not embedded** (see 2.3).
- **Invite not embedded** (see 2.4): A3 returns the Trip to every Member; keeping the token in another collection means it can never leak through a missing projection.
- Size: < 2 KB.

### 2.3 `members`

A named participant in one Trip. A **separate collection**, referenced by id from everything else.

```ts
{
  _id: string;                 // seed: "tokyo-winter:act"
  tripId: string;
  userId: string | null;       // null = Unclaimed Member
  displayName: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'removed';   // NEW — see below
  joinedVia?: 'line' | 'google';
  color: ColorKey;
  createdAt: Date;
  claimedAt?: Date;            // NEW — set by Claim
}
```

Why reference instead of embedding `members[]` in `trips`:
- **Uniqueness.** "A User is at most one Member of a Trip" must be a unique index on `(userId, tripId)`. A unique index does not stop duplicates inside one document's array, so this only works with one document per Member.
- **Claim and role change touch one small document** with a conditional update (no positional array operators, no rewriting the trip).
- Member is referenced by id from Expense (`payerId`, `shares.memberId`), Settlement, Checklist, Activity, Document, Place. Those references never change on Claim because Claim only sets `userId`.
- A2 "trips I am in" is a single indexed query on `userId`.

Cost: A3 needs two indexed point reads (trip + my member). Acceptable.

`status`:
- `active` — normal. Only `active` Members pass `requireMember`.
- `pending` — joined/claimed through an invite with `requireApproval` (B10 `pending: true`) and waiting for B11. Keeps `userId` set so the unique index still stops a second join.
- `removed` — proposed soft removal for B6 (see 5.4, open question). Kept so old Expenses still show the name.

Size: 2–20 per trip, < 500 B each.

### 2.4 `invites`

1:1 with Trip; `_id` **is** the `tripId`.

```ts
{
  _id: string;                 // = tripId
  tripId: string;              // duplicate of _id so the document matches the Invite type
  token: string;               // random, ≥ 128 bits, URL-safe
  expiresAt: Date | null;      // null = never
  requireApproval: boolean;
  updatedAt: Date;
}
```

- Separate because B9 looks it up **by token without a trip context** (public), and to keep the secret out of every Trip read.
- B7 = `updateOne({ _id: tripId }, { $set: … }, { upsert: true })`; B8 replaces `token`.
- No TTL index: an expired invite must still return **410** (not 404), and it carries settings (`requireApproval`) the owner keeps. Expiry is checked in code.

### 2.5 `documents`

Metadata only; the file is in object storage behind a signed URL.

```ts
{
  _id: string;
  tripId: string;
  name: string;
  fileKey: string;             // object-storage key, never a URL
  mime: string;                // allow-list: application/pdf, image/jpeg, image/png, image/heic, image/webp
  size: int;                   // bytes
  uploadedBy: string;          // Member id
  createdAt: Date;
}
```

- Referenced (by id) from `planItems.docIds`, `expenses.slipDocId`, `settlements.slipDocId`. Not embedded there because one document can be linked from several places and is listed on its own (A6).
- Size: 0–50 per trip.

### 2.6 `places`

```ts
{
  _id: string;
  tripId: string;
  name: string;
  type: 'sight' | 'food' | 'interest' | 'stay' | 'transit';
  city: string;
  area: string | null;         // null = "ไม่ระบุย่าน"
  tagIds: string[];            // REFERENCES to tags._id (owned by any User)
  mapUrl?: string;
  note: string;
  costPerPerson?: int;         // satang
  stay?: { checkIn: string; checkOut: string; price?: int; bookingRef?: string; address?: string; expenseId?: Id }; // type "stay" only; dates YYYY-MM-DD within trip, checkOut > checkIn; price satang
  photos?: {                   // max 10; absent on older Places = []
    _id: string;
    fileKey: string;           // object-storage key `${tripId}/places/${placeId}/${photoId}`, never a URL
    mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
    size: int;                 // bytes
    uploadedBy: string;        // Member id
    createdAt: Date;
  }[];
  createdBy: string;           // Member id
  createdAt: Date;
  updatedAt?: Date;
}
```

- **Places are not embedded in Trip**: a trip can have hundreds, they are filtered and edited one by one, and Plan Items reference them.
- **`tagIds` are references, not embedded tag names**: a Tag is renamed/regrouped by its owner and must change everywhere at once (owner edits one Tag document). Bounded per Place (validator: max 30).
- **Unscheduled** is derived (`_id` not in the trip's `planItems.placeId` / `fromPlaceId` / `toPlaceId`); not stored, so it can never drift from the plan.
- **`photos` are embedded**: bounded (max 10, enforced by the validator and by an atomic conditional `$push` on `photos.9` not existing), always read with the Place, never queried on their own. Only metadata is stored; the bytes live in object storage (local disk or a private DigitalOcean Spaces bucket, `STORAGE_DRIVER`) behind expiring signed URLs.
- Size: 10–300 per trip, < 1 KB each (+ ~250 B per photo).

### 2.7 `tags`

Owned by a User, reused across all their trips.

```ts
{
  _id: string;
  ownerId: string;             // User id
  name: string;                // trimmed
  group: string | null;
  color?: ColorKey;
  createdAt: Date;
}
```

- Separate because Tags are not trip-scoped and are shared by reference from Places in many trips.
- `group` is a plain string on the tag (SPEC); no `tagGroups` collection.
- Size: 0–200 per User.

### 2.8 `planItems` (polymorphic on `kind`)

```ts
// kind: 'place'
{
  _id: string;
  tripId: string;
  kind: 'place';
  day: int;                    // 1-based trip day
  time: string | null;         // "HH:mm" or null (untimed)
  placeId: string;
  note: string;
  travelToNext?: Hop;          // EMBEDDED Hop
  createdBy: string;           // NEW — Member id; an editor may edit/delete only their own Plan Items
  createdAt: Date;             // NEW — insertion-order tiebreak for A10
}

// kind: 'transit'
{
  _id: string;
  tripId: string;
  kind: 'transit';
  mode: 'plane' | 'train' | 'bus' | 'car' | 'boat' | 'walk' | 'other';
  fromCode?: string; fromText: string;
  toCode?: string;   toText: string;
  departAt: string;            // "YYYY-MM-DDTHH:mm" local
  arriveAt: string;
  durationMinutes?: int;
  bookingRef?: string;
  seatInfo?: string;
  docIds: string[];            // REFERENCES documents._id
  expenseId?: string;          // REFERENCE expenses._id
  fromPlaceId?: string;        // REFERENCE places._id
  toPlaceId?: string;
  travelToNext?: Hop;
  createdBy: string;           // Member id
  createdAt: Date;
}

type Hop = { mode: 'walk' | 'train' | 'bus' | 'taxi' | 'car'; minutes?: int; note?: string };
```

- **One collection, two kinds** (polymorphic pattern): A10 reads both together as one timeline.
- **Hop embedded**: 1:1 with its Plan Item, always read with it (SPEC: "belongs to the earlier Plan Item").
- **Place referenced, not embedded**: the same Place appears in many Plan Items and is edited in one place.
- **`createdBy`** (Member id) is required on both kinds: an editor may edit or delete only the Plan Items (incl. their Hop) they added; the owner may change all. Seeded items use the trip owner's Member id.
- Transit has **no stored `day`** (matches types/SPEC; its day is derived from `departAt` and `trip.startDate`).
- **A10 sort is done in app code**, not by the index: MongoDB sorts `null` *before* strings (UI needs untimed last), Transit has no `day`, and the tie-break is insertion order. The server fetches `find({ tripId })` (≤ ~200 docs) and sorts with the same rule as `planItemDay` / `planItemTime` in `queries.ts`, then `createdAt`.
- Size: 0–200 per trip, < 1 KB each.

### 2.9 `expenses`

```ts
{
  _id: string;
  tripId: string;
  title: string;
  category: 'stay' | 'transport' | 'food' | 'activity' | 'other';
  payerId: string;             // Member id
  method: 'cash' | 'promptpay' | 'card' | 'wallet';
  cardLast4?: string;          // /^\d{4}$/
  amount: int;                 // satang, > 0
  currency: 'THB';
  baseAmount: int;             // = amount while only THB exists
  splitMode: 'equal' | 'amount' | 'shares';
  shares: { memberId: string; amount: int; weight?: int }[];   // EMBEDDED Shares
  slipDocId?: string;          // REFERENCE documents._id
  note?: string;
  date: string;                // YYYY-MM-DD
  createdBy: string;           // Member id
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
}
```

- **Shares embedded**: bounded by the trip's Member count (validator: 1–50), always read and written with the Expense, and the invariant "Shares sum exactly to `amount`" is only safe if both are written in the same single-document update.
  - `$jsonSchema` cannot check a sum; the app enforces it (`src/domain/money/split`) and returns 400. `Share.amount` is always stored (resolved by the server for `equal` / `shares`).
- **Payer / share Members referenced by `memberId`**, never by `userId` or name — so a Claim never touches Expenses.
- Size: 0–500 per trip, ≤ ~2 KB each (≈ 1 MB per trip at the extreme).

### 2.10 `settlements`

```ts
{
  _id: string;
  tripId: string;
  fromId: string;              // Member id (sender)
  toId: string;                // Member id (receiver)
  amount: int;                 // satang, > 0
  status: 'pending' | 'sent' | 'confirmed';
  slipDocId?: string;
  createdAt: Date;
  sentAt?: Date;               // required when status ∈ {sent, confirmed}
  confirmedAt?: Date;          // required when status = confirmed
}
```

- Separate collection: Settlements have their own lifecycle and per-document conditional updates; embedding them in Trip would make every transition rewrite the trip.
- Only real transfers are stored. Per API.md B32 the sender reports a transfer and it is inserted as **`sent`**; **`pending` is computed** (a Suggested Transfer with no Settlement). `pending` stays in the enum for SPEC compatibility.
- Size: 0–30 per trip.

### 2.11 `checklistItems`

```ts
{
  _id: string;
  tripId: string;
  scope: 'group' | 'personal';
  ownerId?: string;            // Member id — REQUIRED when scope = personal
  text: string;
  category: string;
  assigneeId?: string;         // Member id
  done: boolean;
  doneBy?: string;             // Member id, set by server
  fromTemplate: boolean;
  createdAt: Date;
}
```

- One document per item (not an array in Trip): personal items must be **filtered out in the query** by `ownerId`, and items are ticked independently by many people.
- Size: 10–100 per trip.

### 2.12 `activities`

```ts
{
  _id: string;
  tripId: string;
  actorId: string;             // Member id
  type: 'expense' | 'settlement' | 'plan' | 'member';
  refId: string | null;
  text: string;                // neutral wording; UI replaces the viewer's name with "คุณ"
  createdAt: Date;
  readBy: string[];            // User ids — bounded by the trip's Member count
}
```

- **Separate collection, never embedded**: grows with every write, unbounded.
- `readBy` is an embedded array but bounded by the number of Members (≤ 50), so it is safe.
- A16 is paginated: `limit` 50, cursor = last `createdAt` (+ `_id`).
- Growth policy: no TTL for now (history matters for money disputes) — see Open questions.
- Size: hundreds to a few thousand per trip, < 500 B each.

### 2.13 `personalExpenses`

A **Personal Expense** (CONTEXT.md): money one Member spent only for themself. Private to that Member; no payer, no Shares; never part of the group's money.

```ts
{
  _id: string;
  tripId: string;
  ownerId: string;             // Member id (NOT User id) — the only Member who can see it
  title: string;
  category: 'stay' | 'transport' | 'food' | 'activity' | 'other' | 'shopping';
  amount: int;                 // satang, > 0
  currency: 'THB';
  baseAmount: int;             // = amount while only THB exists
  method: 'cash' | 'promptpay' | 'card' | 'wallet';
  note?: string;
  date: string;                // YYYY-MM-DD, inside the trip (checked in app)
  createdAt: Date;
  updatedAt?: Date;
}
```

- **Separate collection, not a flag on `expenses`** (e.g. `private: true`, no shares):
  - Every group-money read (A11 list, A14/A2/B9 balances, Summary, `isMemberReferenced`, B6 Outstanding check) does `expenses.find({ tripId })`. A flag would mean every one of those must add `private: { $ne: true }`; one forgotten filter leaks a private record to the group or changes Net Balance. A separate collection makes "never affects group money" true by construction.
  - The shapes differ: an Expense requires `payerId`, `splitMode` and 1–50 `shares` (Σ = `amount`); a Personal Expense has none of them, and allows `shopping`, which group Expenses must reject. One validator would need a `oneOf` on the flag and two category enums.
  - Privacy needs `ownerId` as an index key. In `expenses` that would add a third index only for this feature.
- **`ownerId` is a Member id**, like `checklistItems.ownerId`, so a Claim (5.1) never touches this collection. It always comes from the session (Current Member), never from the request body.
- **No `createdBy` / `updatedBy`**: only the owner can write, so they would always equal `ownerId`.
- **No Activity** is written for B45–B47 — the feed is shared by the whole trip.
- **No slip / `cardLast4`** (decision 5 in the plan). Add later as optional fields if wanted.
- `currency` + `baseAmount` kept for the same multi-currency path as Expenses; the header card ("ทริปนี้ฉันใช้") sums `baseAmount`.
- Size: 0–200 per Member per trip, ~300 B each — tiny; at most ~50 × 200 docs per trip.

### 2.14 `requestLogs`

Admin dashboard request log (screen 27). **Capped collection**, 1,000 documents / 1 MB, so MongoDB drops the oldest itself. No indexes besides `_id`; reads use `$natural: -1` (newest first). Written fire-and-forget by `utils/request-log.ts`; `/api/health` and `/api/admin/*` are not recorded; the path has no query string. Not written under `NODE_ENV=test` unless `createApp(config, { recordRequests: true })`.

```ts
{ _id: string; at: Date; method: string; path: string; status: int; ms: int; userId: string | null }
```

## 3. Indexes

`_id` indexes are implicit and not listed. Names are fixed so tests can assert them.

| Collection | Name | Key | Options | Serves |
| --- | --- | --- | --- | --- |
| users | `users_provider_subject` | `{ provider: 1, providerSubject: 1 }` | unique, partial `{ providerSubject: { $type: 'string' } }` | B41 find-or-create. Partial because seed users have no subject. |
| members | `members_user_trip` | `{ userId: 1, tripId: 1 }` | unique, partial `{ userId: { $type: 'string' } }` | auth lookup (every request), A2 (prefix `userId`), A3; uniqueness: one Member per User per Trip, double Claim → E11000 |
| members | `members_trip` | `{ tripId: 1 }` | — | A4, A14, B9, B3 |
| invites | `invites_token` | `{ token: 1 }` | unique | B9, B10 |
| documents | `documents_trip` | `{ tripId: 1 }` | — | A6, B3 |
| places | `places_trip_city_area` | `{ tripId: 1, city: 1, area: 1 }` | — | A7 (all / by city / by city+area), A8 (`distinct`), B23 rename/merge, B3 |
| places | `places_tagIds` | `{ tagIds: 1 }` | multikey | B21 delete tag across **all** trips, B22 usage count |
| tags | `tags_owner_name` | `{ ownerId: 1, name: 1 }` | unique | A9, B18 (mine), B19/B20 duplicate-name check |
| planItems | `planItems_trip_day_time` | `{ tripId: 1, day: 1, time: 1 }` | — | A10 (prefix `tripId`), one-day reads (B24 neighbours, Hop), B17 place cleanup, B3 |
| expenses | `expenses_trip_date` | `{ tripId: 1, date: 1, createdAt: 1 }` | — | A11 (equality + full sort, no in-memory sort), A14/A2/B9 balance reads, B3 |
| settlements | `settlements_trip` | `{ tripId: 1, createdAt: 1 }` | — | A13, A14, B3 |
| settlements | `settlements_open_pair` | `{ tripId: 1, fromId: 1, toId: 1 }` | unique, partial `{ status: 'sent' }` | B32 — one open Settlement per pair, race-safe (decided 2026-11-12) |
| checklistItems | `checklist_trip_scope_owner` | `{ tripId: 1, scope: 1, ownerId: 1 }` | — | A15 — both `$or` branches (see below), B3 |
| activities | `activities_trip_created` | `{ tripId: 1, createdAt: -1 }` | — | A16 without type, B39, B3 |
| activities | `activities_trip_type_created` | `{ tripId: 1, type: 1, createdAt: -1 }` | — | A16 `?type=` |
| activities | `activities_created` | `{ createdAt: -1 }` | — | Admin: busiest trips / active trips in a time window |
| activities | `activities_actor_created` | `{ actorId: 1, createdAt: -1 }` | — | Admin: one User's latest activity (by their Member ids) |
| personalExpenses | `personalExpenses_trip_owner_date` | `{ tripId: 1, ownerId: 1, date: 1, createdAt: 1 }` | — | B44 (equality + full sort, no in-memory sort), B6 hard-delete cleanup, B3 (prefix `tripId`) |

Total: 15 secondary indexes, at most 2 per collection — cheap on writes.

**SPEC index hints**
- `Place { tripId, area }` → **changed to `{ tripId, city, area }`**. B23 renames/merges an Area *within a city*, and A7's city tabs filter by city; `{ tripId, city, area }` serves both plus every `tripId`-only query. Listed under Proposed changes to SPEC.
- `tagIds` multikey → **kept, standalone** (not `tripId`-prefixed) because B21/B22 are cross-trip.
- `PlanItem { tripId, day, time }` → **kept**. It serves `tripId` prefix and per-day queries, but the A10 order (untimed last, transit by `departAt`, insertion order) is applied in app code — see 2.8.

**Query shapes the indexes rely on**
- Auth lookup — the query must contain the partial filter so the planner may use the partial index:
  ```js
  members.findOne({ userId: { $eq: userId, $type: 'string' }, tripId, status: 'active' })
  ```
  A ช่วง 1 test runs `explain()` on this and asserts `IXSCAN` on `members_user_trip`. (MongoDB only uses a partial index when the query predicate implies the filter expression; plain `{ userId: 'act' }` may not be recognised.) A2 uses the same shape without `tripId`.
- A15 checklist:
  ```js
  checklistItems.find({ tripId, $or: [ { scope: 'group' }, { scope: 'personal', ownerId: me } ] })
  ```
  Each `$or` branch becomes an index bound on `checklist_trip_scope_owner` (`tripId` eq + `scope` eq [+ `ownerId` eq]). `ownerId` comes from the session, never the request.
- A11: `expenses.find({ tripId }).sort({ date: 1, createdAt: 1 })` — fully index-ordered.
- A16: `activities.find({ tripId, type? , createdAt: { $lt: cursor } }).sort({ createdAt: -1 }).limit(50)`.
- B44: `personalExpenses.find({ tripId, ownerId: me }).sort({ date: 1, createdAt: 1 })` — same order as A11, fully index-ordered. Do **not** add `_id` to the sort: it is not in the index and would force an in-memory sort. B45–B47 filter on `{ _id, tripId, ownerId: me }`, so another Member's id matches nothing → 404 (never 403, which would confirm it exists).

## 4. Validation

All collections are created with `validationLevel: 'strict'`, `validationAction: 'error'` (new database, no legacy data). `additionalProperties: false` at the top level catches typos, so `_id` is always listed. The app still validates with zod first (better error messages); the validator is the last line of defence.

Shared fragments are written inline below (MongoDB `$jsonSchema` has no `$ref`/`definitions`). In code, build them from TS constants:

```js
const id = { bsonType: 'string', minLength: 1, maxLength: 100 };
const money = { bsonType: ['int', 'long'], minimum: 0 };
const positiveMoney = { bsonType: ['int', 'long'], minimum: 1 };
const color = { enum: ['teal', 'blue', 'orange', 'purple', 'slate', 'gray', 'ink'] };
const isoDate = { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const localDateTime = { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$' };
const hhmm = { bsonType: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const text = (max) => ({ bsonType: 'string', maxLength: max });
const hop = {
  bsonType: 'object', additionalProperties: false, required: ['mode'],
  properties: {
    mode: { enum: ['walk', 'train', 'bus', 'taxi', 'car'] },
    minutes: { bsonType: 'int', minimum: 0, maximum: 1440 },
    note: text(500),
  },
};
```

### users
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'name', 'email', 'provider', 'color', 'createdAt'],
  properties: {
    _id: id, name: text(100), email: text(320), avatarUrl: text(2000),
    provider: { enum: ['line', 'google'] },
    providerSubject: text(200),
    color, sessionVersion: { bsonType: 'int', minimum: 0 }, createdAt: { bsonType: 'date' },
  },
} }
```

### trips
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'name', 'destination', 'startDate', 'endDate', 'budget', 'baseCurrency', 'cover', 'createdBy', 'createdAt', 'updatedAt'],
  properties: {
    _id: id, name: text(100), destination: text(100),
    startDate: isoDate, endDate: isoDate,
    budget: { bsonType: ['int', 'long', 'null'], minimum: 0 },
    baseCurrency: { enum: ['THB'] },
    cover: color,
    legs: { bsonType: 'array', maxItems: 60, items: {
      bsonType: 'object', additionalProperties: false, required: ['city', 'from', 'to'],
      properties: { city: text(100), from: { bsonType: 'int', minimum: 1 }, to: { bsonType: 'int', minimum: 1 } },
    } },
    meetingPoint: text(200),
    createdBy: id, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
  },
} }
```
(`startDate ≤ endDate` and `from ≤ to` within the trip length are checked in the app.)

### members
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'userId', 'displayName', 'role', 'status', 'color', 'createdAt'],
  properties: {
    _id: id, tripId: id,
    userId: { bsonType: ['string', 'null'] },
    displayName: text(50),
    role: { enum: ['owner', 'editor', 'viewer'] },
    status: { enum: ['active', 'pending', 'removed'] },
    joinedVia: { enum: ['line', 'google'] },
    color,
    createdAt: { bsonType: 'date' }, claimedAt: { bsonType: 'date' },
  },
  // a pending Member is always a real User
  anyOf: [ { properties: { status: { enum: ['active', 'removed'] } } },
           { properties: { status: { enum: ['pending'] }, userId: { bsonType: 'string' } } } ],
} }
```

### invites
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'token', 'expiresAt', 'requireApproval', 'updatedAt'],
  properties: {
    _id: id, tripId: id,
    token: { bsonType: 'string', minLength: 22, maxLength: 100 },
    expiresAt: { bsonType: ['date', 'null'] },
    requireApproval: { bsonType: 'bool' },
    updatedAt: { bsonType: 'date' },
  },
} }
```

### documents
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'name', 'fileKey', 'mime', 'size', 'uploadedBy', 'createdAt'],
  properties: {
    _id: id, tripId: id, name: text(200), fileKey: text(500),
    mime: { enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'] },
    size: { bsonType: ['int', 'long'], minimum: 1, maximum: 20971520 },   // 20 MB, final limit TBD in ช่วง 5
    uploadedBy: id, createdAt: { bsonType: 'date' },
  },
} }
```

### places
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'name', 'type', 'city', 'area', 'tagIds', 'note', 'createdBy', 'createdAt'],
  properties: {
    _id: id, tripId: id, name: text(200),
    type: { enum: ['sight', 'food', 'interest', 'stay', 'transit'] },
    city: text(100),
    area: { bsonType: ['string', 'null'], maxLength: 100 },
    tagIds: { bsonType: 'array', maxItems: 30, uniqueItems: true, items: id },
    mapUrl: text(2000), note: text(2000),
    costPerPerson: money,
    stay: { bsonType: "object", additionalProperties: false, required: ["checkIn","checkOut"],
            properties: { checkIn: text(10), checkOut: text(10), price: money, bookingRef: text(100), address: text(300), expenseId: id } },
    photos: { bsonType: 'array', maxItems: 10, items: {
      bsonType: 'object', additionalProperties: false,
      required: ['_id', 'fileKey', 'mime', 'size', 'uploadedBy', 'createdAt'],
      properties: { _id: id, fileKey: text(500), mime: { enum: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'] },
                    size: { bsonType: ['int', 'long'], minimum: 1, maximum: 20971520 }, uploadedBy: id, createdAt: { bsonType: 'date' } } } },
    createdBy: id, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
  },
} }
```

### tags
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'ownerId', 'name', 'group', 'createdAt'],
  properties: {
    _id: id, ownerId: id,
    name: { bsonType: 'string', minLength: 1, maxLength: 50 },
    group: { bsonType: ['string', 'null'], maxLength: 50 },
    color, createdAt: { bsonType: 'date' },
  },
} }
```

### planItems
```js
{ $jsonSchema: {
  bsonType: 'object',
  required: ['_id', 'tripId', 'kind', 'createdAt'],
  oneOf: [
    { additionalProperties: false,
      required: ['kind', 'day', 'time', 'placeId', 'note', 'createdBy'],
      properties: {
        _id: id, tripId: id, kind: { enum: ['place'] },
        day: { bsonType: 'int', minimum: 1, maximum: 366 },
        time: { anyOf: [ hhmm, { bsonType: 'null' } ] },
        placeId: id, note: text(2000), travelToNext: hop,
        createdBy: id, createdAt: { bsonType: 'date' },
      } },
    { additionalProperties: false,
      required: ['kind', 'mode', 'fromText', 'toText', 'departAt', 'arriveAt', 'docIds', 'createdBy'],
      properties: {
        _id: id, tripId: id, kind: { enum: ['transit'] },
        mode: { enum: ['plane', 'train', 'bus', 'car', 'boat', 'walk', 'other'] },
        fromCode: text(10), fromText: text(200), toCode: text(10), toText: text(200),
        departAt: localDateTime, arriveAt: localDateTime,
        durationMinutes: { bsonType: 'int', minimum: 0, maximum: 10080 },
        bookingRef: text(100), seatInfo: text(200),
        docIds: { bsonType: 'array', maxItems: 20, uniqueItems: true, items: id },
        expenseId: id, fromPlaceId: id, toPlaceId: id,
        travelToNext: hop,
        createdBy: id, createdAt: { bsonType: 'date' },
      } },
  ],
} }
```

### expenses
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'title', 'category', 'payerId', 'method', 'amount', 'currency', 'baseAmount', 'splitMode', 'shares', 'date', 'createdBy', 'createdAt'],
  properties: {
    _id: id, tripId: id, title: text(200),
    category: { enum: ['stay', 'transport', 'food', 'activity', 'other'] },
    payerId: id,
    method: { enum: ['cash', 'promptpay', 'card', 'wallet'] },
    cardLast4: { bsonType: 'string', pattern: '^\\d{4}$' },
    amount: positiveMoney,
    currency: { enum: ['THB'] },
    baseAmount: positiveMoney,
    splitMode: { enum: ['equal', 'amount', 'shares'] },
    shares: { bsonType: 'array', minItems: 1, maxItems: 50, items: {
      bsonType: 'object', additionalProperties: false, required: ['memberId', 'amount'],
      properties: { memberId: id, amount: money, weight: { bsonType: 'int', minimum: 1, maximum: 1000 } },
    } },
    slipDocId: id, note: text(2000), date: isoDate,
    createdBy: id, createdAt: { bsonType: 'date' },
    updatedBy: id, updatedAt: { bsonType: 'date' },
  },
} }
```
App-only rules (400): Σ `shares.amount` = `amount`; `memberId`s unique and all Members of the trip; `weight` present iff `splitMode = 'shares'`; `cardLast4` only when `method = 'card'`.

### settlements
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'fromId', 'toId', 'amount', 'status', 'createdAt'],
  properties: {
    _id: id, tripId: id, fromId: id, toId: id,
    amount: positiveMoney,
    status: { enum: ['pending', 'sent', 'confirmed'] },
    slipDocId: id,
    createdAt: { bsonType: 'date' }, sentAt: { bsonType: 'date' }, confirmedAt: { bsonType: 'date' },
  },
  oneOf: [
    { properties: { status: { enum: ['pending'] } } },
    { properties: { status: { enum: ['sent'] } },      required: ['sentAt'] },
    { properties: { status: { enum: ['confirmed'] } }, required: ['sentAt', 'confirmedAt'] },
  ],
} }
```

### checklistItems
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'scope', 'text', 'category', 'done', 'fromTemplate', 'createdAt'],
  properties: {
    _id: id, tripId: id,
    scope: { enum: ['group', 'personal'] },
    ownerId: id, text: text(300), category: text(50),
    assigneeId: id, done: { bsonType: 'bool' }, doneBy: id,
    fromTemplate: { bsonType: 'bool' }, createdAt: { bsonType: 'date' },
  },
  oneOf: [
    { properties: { scope: { enum: ['group'] } } },
    { properties: { scope: { enum: ['personal'] } }, required: ['ownerId'] },
  ],
} }
```

### activities
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'actorId', 'type', 'refId', 'text', 'createdAt', 'readBy'],
  properties: {
    _id: id, tripId: id, actorId: id,
    type: { enum: ['expense', 'settlement', 'plan', 'member'] },
    refId: { bsonType: ['string', 'null'] },
    text: text(500),
    createdAt: { bsonType: 'date' },
    readBy: { bsonType: 'array', maxItems: 100, uniqueItems: true, items: id },
  },
} }
```

### personalExpenses
```js
{ $jsonSchema: {
  bsonType: 'object', additionalProperties: false,
  required: ['_id', 'tripId', 'ownerId', 'title', 'category', 'amount', 'currency', 'baseAmount', 'method', 'date', 'createdAt'],
  properties: {
    _id: id, tripId: id, ownerId: id, title: text(200),
    category: { enum: ['stay', 'transport', 'food', 'activity', 'other', 'shopping'] },
    amount: positiveMoney,
    currency: { enum: ['THB'] },
    baseAmount: positiveMoney,
    method: { enum: ['cash', 'promptpay', 'card', 'wallet'] },
    note: text(2000), date: isoDate,
    createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
  },
} }
```
App-only rules (400): `date` within the trip's `startDate`–`endDate`; `title` not blank; `baseAmount` = `amount` (set by the server, also on PATCH when `amount` changes). `ownerId`, `currency`, `baseAmount` are never accepted from the request.

## 5. Write paths

Transactions need a replica set (standalone `mongod` does not support them). None of the paths below **requires** one; where a transaction would add safety it is noted. For tests that do want one, `mongodb-memory-server` offers `MongoMemoryReplSet`.

### 5.1 Claim (B10)

Because Expenses, Shares, Settlements, Checklist and Activity reference **`memberId`**, a Claim changes only the Member document.

1. Load invite by `token` (`invites_token`); expired → 410.
2. Conditional update:
   ```js
   members.updateOne(
     { _id: claimMemberId, tripId, userId: null, status: 'active' },
     { $set: { userId, joinedVia: provider, claimedAt: now, status: requireApproval ? 'pending' : 'active' } },
   )
   ```
   - `matchedCount === 0` → re-read: not found → 404, already claimed → **409**.
   - E11000 on `members_user_trip` → the User is already a Member of this trip → **409**.
3. Insert Activity `type: 'member'`.

Atomicity: step 2 is one single-document write — atomic, and safe against two people claiming the same name at once (only one matches `userId: null`). Step 3 is best-effort; if it fails the Claim still stands (log it). **No transaction needed.**

"Add myself" (B10 with `displayName`) is an `insertOne` with `userId` set; the unique index turns a double join into 409.

### 5.2 Delete Tag (B21)

1. `tags.findOne({ _id: tagId, ownerId: currentUserId })` → missing → 404 (or 403 if it exists with another owner).
2. `places.updateMany({ tagIds: tagId }, { $pull: { tagIds: tagId } })` → `removedFromPlaces = modifiedCount` (uses `places_tagIds`, across all trips).
3. `tags.deleteOne({ _id: tagId, ownerId: currentUserId })`.

Order is pull-then-delete so a crash leaves an unused tag (retry is safe), never a dangling id. A Place written concurrently between 2 and 3 could still get a dangling id, so **readers ignore unknown `tagIds`** (A8 uses `$in`, which naturally skips them). No transaction.

B22 usage (`GET /api/me/tags/usage`, all of my tags at once) = `places.aggregate([{ $match: { tagIds: { $in: myTagIds } } }, { $unwind: "$tagIds" }, { $match: { tagIds: { $in: myTagIds } } }, { $group: { _id: "$tagIds", n: { $sum: 1 } } }])`.

### 5.3 Settlement transitions (B32–B34)

Allowed: `pending → sent → confirmed`. Never skip or go back. Every transition is **one conditional `updateOne` that filters on the current status and on who may act**:

| Step | Who | Operation |
| --- | --- | --- |
| report (B32) | sender (any role, incl. viewer) | `insertOne({ …, fromId: me, status: 'sent', sentAt: now, createdAt: now })` — `pending` is not stored (API.md). E11000 on `settlements_open_pair` → 409. Then re-read the trip's Settlements: if my `sent` total > what I owe, `deleteOne({ _id, status: 'sent' })` and 400 (BUG-B6) |
| pending → sent (only if a `pending` doc ever exists) | sender | `updateOne({ _id, tripId, fromId: me, status: 'pending' }, { $set: { status: 'sent', sentAt: now, slipDocId? } })` |
| sent → confirmed (B33) | receiver | `updateOne({ _id, tripId, toId: me, status: 'sent' }, { $set: { status: 'confirmed', confirmedAt: now } })` |
| replace slip (B34) | sender | `updateOne({ _id, tripId, fromId: me, status: 'sent' }, { $set: { slipDocId } })` |

On `matchedCount === 0`, re-read `{ _id, tripId }`: missing → 404; wrong person → 403; wrong status → **409**. Two receivers clicking at once: one matches, the other gets 409. The validator additionally requires `sentAt` / `confirmedAt` for those statuses. No transaction.

Use `findOneAndUpdate(..., { returnDocument: 'after' })` to return the new Settlement in one round trip.

### 5.4 Delete Member (B6)

1. Owner only; cannot remove the last `owner` (→ 409; check `members.countDocuments({ tripId, role: 'owner', status: 'active' })`).
2. Compute the Member's **Outstanding** (section 6). ≠ 0 → **409** (API.md proposal; SPEC open item).
3. Outstanding = 0 but the Member is still referenced (`expenses` with `payerId` or `shares.memberId`, or any `settlements` row) → **proposed**: soft remove — `updateOne({ _id, tripId, status: 'active' }, { $set: { status: 'removed' } })`. The Member disappears from A4 / auth but old Expenses still show the name. *(Open question.)*
4. Not referenced anywhere → hard `deleteOne`; also `deleteMany` their personal checklist items, `$unset` `assigneeId` on group items, and `personalExpenses.deleteMany({ tripId, ownerId: memberId })` (uses `personalExpenses_trip_owner_date`). Personal Expenses do **not** count as "referenced" in step 3 — they are private and have no money link to anyone.
   - Order: delete the Member first, then the cleanups. A crash in between leaves records whose `ownerId` matches no Member — nobody can read them (every read filters on the Current Member), and re-running B6 / the orphan sweep (5.5) removes them. No transaction.
   - Soft-removed Members (step 3) keep their Personal Expenses; nobody can see them, and they go with the trip (see Open questions).

Race: an Expense can be added for this Member between step 2 and step 3/4. Acceptable at this scale; if it matters, run steps 2–4 in a transaction (replica set) or re-check after writing. Removing a Member never touches Expenses.

### 5.5 Delete Trip (B3)

1. Owner only.
2. `trips.deleteOne({ _id: tripId })` first — from now on every endpoint returns 404 because the trip lookup fails.
3. `deleteMany({ tripId })` on `members`, `invites`, `places`, `planItems`, `expenses`, `settlements`, `personalExpenses`, `checklistItems`, `activities`, `documents` (each uses its `tripId`-leading index).
4. Delete the files of the removed `documents` and the `photos` embedded in the removed `places` from object storage (collect the `fileKey`s before step 3).

`tags` are owned by Users and are **not** deleted. No transaction (could be large); every step is idempotent, so a crash is fixed by re-running, and a periodic "orphans whose `tripId` has no trip" sweep is a safety net.

### 5.6 Other referential cleanups

| Delete | Also do |
| --- | --- |
| Place (B17) | 409 if any Transit has `fromPlaceId`/`toPlaceId` = it (API.md); else `planItems.deleteMany({ tripId, kind: 'place', placeId })`, then delete its `photos` files from object storage |
| Expense (B31) | `planItems.updateMany({ tripId, expenseId }, { $unset: { expenseId: '' } })` |
| Document (B14) | `planItems.updateMany({ tripId, docIds: docId }, { $pull: { docIds: docId } })`; slip in use by an Expense/Settlement → proposed 409 (open question); then delete the file |

## 6. Balance computation

Nothing derived is stored. `personalExpenses` is **never read** here (nor by Summary / A2 / B9): Personal Expenses do not affect group money. The personal header card ("ทริปนี้ฉันใช้") = my `share` from A14 + Σ `baseAmount` of my B44 rows, summed in the frontend.

Definitions from `CONTEXT.md`:
- Net Balance(m) = Σ `amount` of Expenses where `payerId = m` − Σ `shares.amount` where `shares.memberId = m`.
- Outstanding(m) = Net(m) + Σ confirmed Settlements `fromId = m` − Σ confirmed Settlements `toId = m`.
- Suggested Transfers = greedy match of Outstanding debtors to creditors (fewest transfers).

**Recommended: app code**, reusing the tested `src/domain/money` (`balance`, `settle`):

```js
const [members, expenses, settlements] = await Promise.all([
  members.find({ tripId, status: { $ne: 'removed' } }).toArray(),                          // members_trip
  expenses.find({ tripId }, { projection: { payerId: 1, amount: 1, shares: 1 } }).toArray(), // expenses_trip_date prefix
  settlements.find({ tripId }).toArray(),                                                    // settlements_trip
]);
```

Cost: 3 indexed reads; ≤ 500 expenses × ~300 B projected ≈ 150 KB worst case; O(expenses + members) in memory. One code path for the Summary, SettleUp, Trips card and B6 check, and it is the same code the Tokyo-number tests cover.

- **A2** (Trips page) runs this per trip the User is in (typically < 20, and past trips could be limited to the visible tab).
- **B9** (JoinTrip: per Unclaimed Member, expense count and total) uses the same expense read.

**Scaling option** (if trips grow to thousands of expenses): an aggregation on `expenses` that returns only per-Member sums:

```js
expenses.aggregate([
  { $match: { tripId } },                                                   // expenses_trip_date
  { $project: { rows: { $concatArrays: [
      [ { memberId: '$payerId', paid: '$amount', share: 0 } ],
      { $map: { input: '$shares', as: 's', in: { memberId: '$$s.memberId', paid: 0, share: '$$s.amount' } } },
  ] } } },
  { $unwind: '$rows' },
  { $group: { _id: '$rows.memberId', paid: { $sum: '$rows.paid' }, share: { $sum: '$rows.share' } } },
]);
```
plus a small `$group` on confirmed settlements. Suggested Transfers stay in app code either way. Not needed now.

## 7. Differences from SPEC / frontend types

| Item | SPEC / types | Schema | Why |
| --- | --- | --- | --- |
| `id` | `id: string` | stored as `_id: string`; API maps | MongoDB primary key |
| `Member.status` | — | `'active' \| 'pending' \| 'removed'` | B10 approval (`pending`), proposed soft remove; API can omit or expose it |
| `Member.createdAt`, `claimedAt` | — | added | audit; Claim time |
| `User.providerSubject`, `createdAt` | — | added | OAuth find-or-create (B41) |
| `PlanItem.createdAt` | — | added | A10 insertion-order tiebreak (seed ids are not monotonic) |
| `PlanItem.createdBy` | — | added (Member id, required) | editor may edit/delete only own Plan Items |
| `Place.createdAt/updatedAt`, `Tag.createdAt`, `ChecklistItem.createdAt`, `Document.createdAt`, `Trip.createdAt/updatedAt`, `Invite.updatedAt` | — | added | audit / sorting; API may omit |
| Timestamps | ISO strings | BSON `date` | real instants; API serialises to ISO |
| `Settlement.pending` | stored status | in enum, but normally **not stored** (computed from Suggested Transfers) | API.md B32 |
| Fields in types but not SPEC (`Expense.date/createdAt/updatedBy/updatedAt/cardLast4/note`, `Settlement.createdAt/sentAt/confirmedAt`, `ChecklistItem.done`, `Activity.readBy`, `Trip.meetingPoint/createdBy`, `Member.color`, `User.color`, `Place.createdBy`, Transit `fromCode/toCode/durationMinutes/seatInfo/fromPlaceId/toPlaceId`) | — | stored | as listed in API.md |
| `Invite` | separate model | separate collection with `_id = tripId` | 1:1; token lookup |
| `PersonalExpense` | not yet in SPEC data model / `types.ts` (being added, see `wondrous-dancing-torvalds.md`) | `personalExpenses` collection (2.13) | new feature |
| Personal Expense endpoint numbers | plan file says B39–B42 | **B44–B47** here | B39–B43 are already used in API.md (activity read, OAuth start/callback, logout, dev login) |

### Proposed changes to SPEC

1. **Place index `{ tripId, area }` → `{ tripId, city, area }`.** Area names are only unique within a city (B23 renames/merges inside a city), and city tabs filter by city. The new index also covers every `tripId`-only query.
2. **PlanItem order:** state that the plan order is "day, time (untimed last), insertion order" and is applied in the app; the `{ tripId, day, time }` index serves the trip/day fetch, not the final order.
3. **Settlement `pending`:** clarify that `pending` is a computed state (a Suggested Transfer nobody has acted on) and that stored Settlements start at `sent`.
4. **Member status:** add `status` (`active` / `pending`, and `removed` if soft removal is accepted).
5. **Personal Expense:** add `PersonalExpense { id, tripId, ownerId (Member), title, category (5 + shopping), amount, currency, baseAmount, method, note?, date, createdAt, updatedAt? }` to the data model, with index `{ tripId, ownerId, date, createdAt }`, and state that it is private and outside all group-money calculations.

## 8. Open questions

1. **Claim transaction** — `first-backend.md` lists "transaction at Claim?" as undecided. With this schema Claim updates only the Member document, so no transaction is needed. Please confirm and close that item.
2. **Delete Member with Outstanding = 0 but referenced by Expenses/Settlements** — soft remove (`status: 'removed'`) or 409? (SPEC open edge case.) Proposed: soft remove.
3. **Activity growth** — keep forever, TTL (e.g. 1 year after trip end — would need a stored `expireAt`), or archive when a trip is past? Proposed: keep forever for now; the paginated indexes handle growth.
4. **Tag name uniqueness** — `{ ownerId, name }` is unique and exact-match. Should "Ramen" and "ramen" be the same tag? Options: collation `{ locale: 'en', strength: 2 }` on the index (queries must use the same collation) or a stored `nameKey` (lowercased, trimmed). Thai has no case, so this is only about Latin text and spaces.
5. **Invite expiry** — checked in code (410), no TTL index, because the invite document keeps `requireApproval` and an expired link should say "expired", not "not found". OK?
6. **Deleting a Document used as a slip** — 409, or unset `slipDocId` on the Expense/Settlement?
7. **Editing an Expense after a related Settlement is confirmed** (SPEC open edge case) — the schema allows it (balances are computed); should the API block it or warn?
8. ~~**Duplicate open Settlements**~~ — **decided 2026-11-12:** one open (`sent`) Settlement per sender–receiver pair, enforced by `settlements_open_pair`. The total a sender reports as `sent` is also capped at what they owe (BUG-B6, API.md B32), checked in code with a re-check after insert.
9. **Money cap** — zod limit of ฿20,000,000 per amount/budget keeps every value int32. Acceptable?
10. **Multi-currency (SPEC open item)** — the schema already has `currency` and `baseAmount`; a future `rate` field would be added then.
11. **Personal Expenses of a soft-removed Member** — kept (invisible to everyone) until the trip is deleted. Alternative: delete them at soft remove too, since their owner can no longer open the trip. **Decided (2026-11-13): keep** — if soft removal is ever reversed, the Member gets them back.
12. **Trip dates shrink (B2)** — existing Personal Expenses (like Expenses) may then fall outside the trip. **Decided (2026-11-13): allow**; only new writes are checked.
