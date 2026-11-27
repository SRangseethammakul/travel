# Travel Planner — API list (from the frontend)

Derived from `frontend/src/lib/api/` (types.ts, session.ts, queries.ts, dev-actions.ts) as of frontend phase 1, plus the screens planned in `first-frontend.md` phases 2–5 and `docs/design/SPEC.md`.

- **Part A** — reads the frontend already calls (through the mock). The backend must return these shapes so `lib/api` can switch from `lib/mock` without changing components.
- **Part B** — writes the frontend will need in phases 3–5. Shapes are proposed; the frontend has not written them yet.

Types (`Trip`, `Member`, `Expense`, …) refer to `frontend/src/lib/api/types.ts`. Terms follow `CONTEXT.md`.

## Conventions

- Base path `/api`. JSON in and out. IDs are strings.
- Money is integer satang (`Satang`). Dates are `ISODate` (`2026-12-12`); timestamps are full ISO; transit times are `LocalDateTime` (`2026-12-12T00:30`, local wall clock).
- Auth: session cookie (signed `userId.sessionVersion.expiresAt`, 30 days). Logout (B42) bumps the User's `sessionVersion` on the server, so every session cookie issued before it — including a copied one — gets `401`; it signs the User out on all devices. In development/test only, the `mock-user` cookie holds a **User id** (`act`, `mint`, `beam`, `ploy`, `n`) and is not affected by logout.
- The **Current Member** is always derived on the server from the session + `tripId`. The client never sends "who I am".
- Not a Member of the trip → `404` (don't reveal the trip exists). Wrong role → `403`.
- Errors: `{ "error": { "code": string, "message": string } }` with 400 / 401 / 403 / 404 / 409. `message` is Thai. Also `413` (`file_too_large`, uploads) and `429` (`rate_limited`).
- Rate limits (30 per 15 min): OAuth start/callback per client IP (needs `TRUST_PROXY` set to the proxies in front, see backend `src/config/config.ts`; production refuses to start with `TRUST_PROXY=0`); uploads (B12, B15a) per User; logout (B42) not limited.
- Net Balance, Outstanding, and Suggested Transfers are computed per request, never stored.
- Every write adds an `Activity`.

Roles column: **any** = any Member of the trip · **editor+** = owner or editor · **owner** = owner only · **self** = see note.

---

## Part A — reads used by the frontend now

| # | Method & path | Role | Frontend function | Response |
| --- | --- | --- | --- | --- |
| A1 | `GET /api/me` | signed in | `getCurrentUser()` | `User` |
| A2 | `GET /api/trips` | signed in | `listMyTrips()` | `{ trip: Trip; me: Member; outstanding: Satang }[]`, sorted by `startDate` |
| A3 | `GET /api/trips/:tripId` | any | `getTrip()`, `requireTripMember()` | `{ trip: Trip; me: Member }` |
| A4 | `GET /api/trips/:tripId/members` | any | `getMembers()` | `Member[]` |
| A5 | `GET /api/trips/:tripId/invite` | owner | `getInvite()` | `Invite \| null` |
| A6 | `GET /api/trips/:tripId/documents` | any | `getDocuments()` | `TripDocument[]` (no file URLs) |
| A7 | `GET /api/trips/:tripId/places` | any | `getPlaces()` | `Place[]` (each with `photos`, see B15a) |
| A8 | `GET /api/trips/:tripId/tags` | any | `getTripTags()` | `Tag[]` — every tag used on a Place in this trip (Places filter) |
| A9 | `GET /api/me/tags` | signed in | `getUserTags(userId)` | `Tag[]` — the current User's tags only (ManageTags) |
| A10 | `GET /api/trips/:tripId/plan` | any | `getPlanItems()` | `PlanItem[]` sorted by day, then time (untimed last), then insertion order |
| A11 | `GET /api/trips/:tripId/expenses` | any (viewers too, all Expenses) | `getExpenses()` | `Expense[]` sorted by `date`, then `createdAt` |
| A12 | `GET /api/trips/:tripId/expenses/:expenseId` | any (viewers too) | `getExpense()` | `Expense` |
| A13 | `GET /api/trips/:tripId/settlements` | any (viewers too, all Settlements) | `getSettlements()` | `Settlement[]` |
| A14 | `GET /api/trips/:tripId/balances` | any (viewer: own numbers only) | `getTripBalances()` | `TripBalances` (see below) |
| A15 | `GET /api/trips/:tripId/checklist` | any | `getChecklist()` | `ChecklistItem[]` — group items + the Current Member's personal items only |
| A16 | `GET /api/trips/:tripId/activity?type=` | any | `getActivity()` | `Activity[]` newest first; optional `type` = `expense \| settlement \| plan \| member` |
| A17 | `GET /api/dev/users` | dev only | `listUsers()` | `User[]` — for the dev user switcher; 404 in production |

### Notes on Part A

- **A2** adds `outstanding` (the Current Member's Outstanding per trip) so the Trips page doesn't call A14 once per trip. The mock computes it in the page today.
- **A3** replaces both `getTrip` and `requireTripMember`. The frontend redirects to `/trips` on 404.
- **A14 `TripBalances`:**
  ```ts
  {
    total: Satang;
    rows: { member: Member; paid: Satang; share: Satang; net: Satang; outstanding: Satang }[];
    transfers: { from: Member; to: Member; amount: Satang; settlement: Settlement | null }[];
  }
  ```
  **Viewer (SPEC "ดูยอดของตัวเอง", decided 2026-11-12, revised the same day):** A11/A12 return every Expense and A13 every Settlement of the trip, for viewers too. Only balances and summary are filtered: `rows` has only the viewer's own row and `transfers` only those where the viewer is `from` or `to`; `total` stays the trip total. owner/editor get every row. The same applies to `GET /api/trips/:tripId/summary` (`rows` + their `items`; `byCategory` stays the whole trip).
  `net` = paid − share (Expenses only). `outstanding` = net after `confirmed` Settlements. `transfers` = Suggested Transfers from Outstanding, each with the matching non-confirmed Settlement if one exists. Test numbers for the Tokyo trip: total ฿30,350; net Act +14,050 · Mint −3,100 · Beam −5,800 · Ploy −5,150; outstanding Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150.
- **A15:** today `getChecklist(tripId, viewerMemberId)` takes the viewer id from the caller. The API must not accept it — the server filters by the session's Member, in the query.
- **A16:** `Activity.text` is stored neutral (e.g. "แจ้งโอนเงินให้ Act"); the frontend turns the viewer's own name into "คุณ". Paging: `?limit=` (1–100, default 50) and `?before=<createdAt of the last item shown>&beforeId=<its id>`. With `beforeId` the next page starts exactly after that item; `before` alone is inclusive (so items in the same millisecond are never skipped) and the client dedupes by `id`.
- Not endpoints (stay in the frontend as pure functions): `planItemDay`, `planItemTime`, `scheduledPlaceIds`, grouping by area/type/day.

---

## Part B — writes needed for phases 3–5 (proposed)

### Trips, members, invites (phase 5: CreateTrip 6, Members 20, JoinTrip 10)

| # | Method & path | Role | Screen | Body → Response |
| --- | --- | --- | --- | --- |
| B1 | `POST /api/trips` | signed in | 6 CreateTrip | `{ name, destination, startDate, endDate, budget?, cover, legs?, members: { displayName }[] }` → `Trip` (creator becomes `owner` Member; other members are Unclaimed) |
| B2 | `PATCH /api/trips/:tripId` | owner | 6 / 16 TripRoute | partial `Trip` (incl. `legs`, `meetingPoint`) → `Trip` |
| B3 | `DELETE /api/trips/:tripId` | owner | 20 | → `204` |
| B4 | `POST /api/trips/:tripId/members` | owner | 6 / 20 | `{ displayName, role? }` → `Member` (Unclaimed) |
| B5 | `PATCH /api/trips/:tripId/members/:memberId` | owner | 20 | `{ role }` → `Member` (can't demote the last owner → 409) |
| B6 | `DELETE /api/trips/:tripId/members/:memberId` | owner | 20 | → `204`; Member with Outstanding ≠ 0 → 409 (open SPEC edge case) |
| B7 | `PUT /api/trips/:tripId/invite` | owner | 20 | `{ expiresIn: '1d' \| '7d' \| 'never', requireApproval }` → `Invite` |
| B8 | `POST /api/trips/:tripId/invite/reset` | owner | 20 | → `Invite` with a new `token` |
| B9 | `GET /api/join/:token` | public | 10 JoinTrip | → `{ trip: Pick<Trip, 'name' \| 'destination' \| 'startDate' \| 'endDate' \| 'cover'>; members: { member: Member; expenseCount: number; total: Satang }[] }` (Unclaimed Members with what is linked to them); expired → 410 |
| B10 | `POST /api/join/:token` | signed in | 10 | `{ claimMemberId }` or `{ displayName }` → `{ tripId, member: Member, pending: boolean }` (`pending` when approval is required); claiming an already-claimed Member → 409 |
| B11 | `POST /api/trips/:tripId/members/:memberId/approve` | owner | 20 / 21 | → `Member` |
| B11a | `POST /api/trips/:tripId/members/:memberId/reject` | owner | 20 | → `{ member: Member \| null }`: a pending Claim goes back to the Unclaimed Member (claimable again), a pending newcomer is deleted; not pending → 409 |

### Documents (phase 5)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B12 | `POST /api/trips/:tripId/documents` | editor+ · any for `kind=slip` | multipart `file` + `name` + `kind?` → `TripDocument` (PDF/images, 10 MB). A viewer may upload only `kind=slip` (to report a Settlement), else `403`. |
| B13 | `GET /api/trips/:tripId/documents/:docId/url` | any | → `{ url, expiresAt }` signed URL |
| B14 | `DELETE /api/trips/:tripId/documents/:docId` | owner or uploader | → `204` |

Slips for Expenses and Settlements use B12 and then pass `slipDocId`.

### Places, tags, areas (phase 4: AddPlace 8/15, ManageTags 17)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B15 | `POST /api/trips/:tripId/places` | editor+ | `{ name, type, city, area, tagIds?, newTags?: string[], mapUrl?, note, costPerPerson?, stay? }` → `Place` (`stay` = `{ checkIn, checkOut, price?, bookingRef?, address?, expenseId? }`, only for `type: "stay"`, dates `YYYY-MM-DD` inside the trip, `checkOut > checkIn`, else 400; `stay.expenseId` must be an Expense of this trip else 400 `unknown_expense`, and deleting that Expense (B31) unsets it) (`newTags` creates Tags owned by the current User; picking another Member's tag reuses its id) |
| B15a | `POST /api/trips/:tripId/places/:placeId/photos` | editor+ | multipart `file` (JPEG/PNG/WebP/HEIC, type read from the bytes, 10 MB, max 10 photos per Place) → `201` `PlacePhoto`. `400 unsupported_file_type`, `413 file_too_large`, `409 photo_limit` when the Place already has 10 photos. Activity `เพิ่มรูป "<place name>"`. |
| B15b | `DELETE /api/trips/:tripId/places/:placeId/photos/:photoId` | owner or uploader | → `204` (`403` for anyone else, `404 photo_not_found`). Activity `ลบรูป "<place name>"`. |
| B16 | `PATCH /api/trips/:tripId/places/:placeId` | editor+ | partial → `Place` (`stay: null` removes it; `stay` is replaced whole, so omitting `expenseId` in a PATCH unlinks the Expense) |
| B17 | `DELETE /api/trips/:tripId/places/:placeId` | editor+ | → `204` (also removes its place Plan Items and its photo files; returns 409 if a Transit references it as from/to) |
| B18 | `GET /api/trips/:tripId/tags/suggest?q=` | any | → `{ mine: Tag[]; others: Tag[] }` — my tags first, then other tags used in this trip |
| B19 | `POST /api/me/tags` | signed in | `{ name, group? }` → `Tag` |
| B20 | `PATCH /api/me/tags/:tagId` | tag owner | `{ name?, group? }` → `Tag` |
| B21 | `DELETE /api/me/tags/:tagId` | tag owner | → `{ removedFromPlaces: number }` (removes the tag from every Place; the confirm dialog shows this count — get it first from B22) |
| B22 | `GET /api/me/tags/usage` | signed in | → `Record<tagId, number>` — Places (in any trip) per tag, for the current User's tags only; tags on no Place are left out (matches `getTagUsage(userId)` in `frontend/src/lib/api/plan-queries.ts`) |
| B23 | `PATCH /api/trips/:tripId/areas` | editor+ | `{ city, from, to }` → `{ updatedPlaces: number }` (rename or merge an Area) |

**Place photos.** Every `Place` response (A7 list, `?group=` groups, get one, B15, B16) has `photos: PlacePhoto[]` (`[]` when none), oldest first:

```ts
PlacePhoto = {
  id: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
  size: number;            // bytes
  uploadedBy: string;      // Member id
  createdAt: string;       // ISO
  url: string;             // signed, opens the image directly (use as <img src>); no session needed
  urlExpiresAt: string;    // ISO — about 15 minutes after the response; re-fetch the Place for fresh URLs
}
```

The file key is never returned. Storage is `STORAGE_DRIVER=local` (dev: `url` is `${PUBLIC_API_URL}/api/files/places/:placeId/photos/:photoId?exp&sig`, an HMAC link served by the backend) or `s3` (`url` is a presigned DigitalOcean Spaces GET link on the bucket host). Documents (B12–B14) use the same storage. Deleting a Trip (B3) deletes all its Documents and photo files.

### Plan (phase 4: PickPlace 13, AddTransit 18, TripRoute 16)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B24 | `POST /api/trips/:tripId/plan/places` | editor+ | `{ placeId, days: number[], time?: string, note? }` → `PlacePlanItem[]` (one per day) |
| B25 | `POST /api/trips/:tripId/plan/transits` | editor+ | `{ mode, fromText, fromCode?, toText, toCode?, departAt, arriveAt, durationMinutes?, bookingRef?, seatInfo?, docIds?, expenseId?, fromPlaceId?, toPlaceId? }` → `TransitPlanItem` |
| B26 | `PATCH /api/trips/:tripId/plan/:itemId` | editor+ | partial (incl. `day`, `time`, `note`) → `PlanItem` |
| B27 | `PUT /api/trips/:tripId/plan/:itemId/hop` | editor+ | `{ mode, minutes?, note? }` → `PlanItem`; `DELETE` same path removes it |
| B28 | `DELETE /api/trips/:tripId/plan/:itemId` | editor+ | → `204` |

City Legs are edited with B2 (`legs`).

### Money (phase 3: AddExpense 4, ExpenseDetail 11, SettleUp 12)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B29 | `POST /api/trips/:tripId/expenses` | editor+ | `{ title, category, payerId, method, cardName?, cardLast4?, amount, splitMode, shares: { memberId, amount?, weight? }[], slipDocId?, note?, date }` → `Expense` |
| B30 | `PATCH /api/trips/:tripId/expenses/:expenseId` | owner, or editor who created it | same fields, partial → `Expense` |
| B31 | `DELETE /api/trips/:tripId/expenses/:expenseId` | owner, or editor who created it | → `204` |
| B32 | `POST /api/trips/:tripId/settlements` | self (sender) | `{ toId, amount?, slipDocId? }` → `Settlement` with `status: 'sent'` (the sender reports a transfer; `fromId` = Current Member; `toId` must be an `active` Member, else `400`; see the Settlement rules below) |
| B33 | `POST /api/trips/:tripId/settlements/:id/confirm` | self (receiver) | → `Settlement` with `status: 'confirmed'`; not `sent` → 409 |
| B34 | `POST /api/trips/:tripId/settlements/:id/slip` | self (sender) | `{ slipDocId }` → `Settlement` (replace the slip while still `sent`) |

Expense rules (server-side, 400 on failure):
- `currency` is always `'THB'`; the server sets `baseAmount = amount`.
- `equal`: send `memberId`s only; the server splits, giving leftover satang to the payer, or to the first listed Member if the payer isn't sharing.
- `shares`: send `weight`s; the server computes amounts, with leftover satang going the same way.
- `amount`: send amounts; they must sum exactly to `amount`.
- Every `memberId` and `payerId` must be a Member of the trip.
- `cardName` (trimmed, 1–30 chars; blank = absent) only with `method: "card"` (400 `invalid_card`). PATCH: `cardName: null` (or blank) removes it; changing `method` away from card drops it. `cardLast4` is legacy: still stored and returned for old data, still accepted, but clients should send `cardName`.

Settlement rules: status only moves `pending` → `sent` → `confirmed`. Viewers may report (B32) their own transfers, and a viewer who is the receiver may confirm (B33) — kept as is (QA Q3). `pending` comes from a Suggested Transfer in A14 and is not stored until someone acts on it.

B32 checks, in order:
1. `toId` is not me (400 `invalid_receiver`), is an `active` Member (400 `unknown_member`); an Unclaimed Member is allowed (they confirm after someone Claims the name); `slipDocId` is a Document of the trip (400).
2. One open Settlement per pair: I already have a `sent` Settlement to `toId` → 409 `already_sent` (unique index `settlements_open_pair`).
3. I owe nothing (my Outstanding ≥ 0), or `amount` is omitted and there is no Suggested Transfer from me to `toId` → 409 `nothing_owed`.
4. The receiver is owed nothing (their Outstanding ≤ 0) → 400 `receiver_not_owed`.
5. **Limit (BUG-B6):** `amount` + all my other `sent` Settlements ≤ −(my Outstanding). Over (or nothing left to report) → 400 `amount_too_large`, the message names what is left. Outstanding counts `confirmed` Settlements only. Without `amount`, the Suggested Transfer is used, lowered to what is left.
6. Parallel reports to different receivers: after inserting, the server re-checks the limit and deletes its own report if the total is now over (400). Both requests may be refused; both are never kept. Remaining risk without a transaction: for a few milliseconds the backed-out report is readable (A13/A14), and if the receiver confirms it in that window it is kept.

### Checklist (phase 5: Checklist 22)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B35 | `POST /api/trips/:tripId/checklist` | any (personal) / editor+ (group) | `{ scope, text, category, assigneeId? }` → `ChecklistItem` (personal: `ownerId` = Current Member) |
| B36 | `PATCH /api/trips/:tripId/checklist/:itemId` | any for group (tick/assign); owner of the item for personal | `{ done?, assigneeId?, text? }` → `ChecklistItem` (`doneBy` set by the server); empty body → `400`; `assigneeId` must be an `active` Member |
| B37 | `DELETE /api/trips/:tripId/checklist/:itemId` | editor+ for group; owner of the item for personal | → `204` |
| B38 | `GET /api/checklist/suggestions?scope=` | signed in | → `{ text, category }[]` (static list) |

Another Member's personal item → 404.

### Personal Expenses (ค่าใช้จ่ายส่วนตัว)

A Personal Expense is private to the Member who made it (`ownerId` = Current Member). Any role, viewers included, may create, edit and delete their own. It has no payer and no Shares, adds no Activity, and never changes the trip total, Net Balance, Outstanding, Suggested Transfers, Settlements or the Summary.

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B44 | `GET /api/trips/:tripId/personal-expenses` | any (own only) | → `PersonalExpense[]`, sorted by `date`, then `createdAt` |
| B45 | `POST /api/trips/:tripId/personal-expenses` | any | `{ title, category, amount, method, cardName?, date, note? }` → `201 PersonalExpense` |
| B46 | `PATCH /api/trips/:tripId/personal-expenses/:id` | owner of the record | same fields, partial; `note: null` / `cardName: null` remove them; changing `method` away from card drops `cardName`; empty body → `400` → `PersonalExpense` |
| B47 | `DELETE /api/trips/:tripId/personal-expenses/:id` | owner of the record | → `204` |

`PersonalExpense` = `{ id, tripId, ownerId, title, category, amount, currency: 'THB', baseAmount, method, note?, date, createdAt, updatedAt? }`.
- `category`: `stay | transport | food | activity | other | shopping` (group Expenses keep the first 5 only).
- `amount`: integer satang > 0; `baseAmount` = `amount`. `method`: `cash | promptpay | card | wallet`. `date`: `YYYY-MM-DD` inside the trip.
- Errors: invalid body → `400 invalid_input`; date outside the trip → `400 date_outside_trip`; another Member's record or an unknown id → `404 personal_expense_not_found`.
- Removing a Member (hard delete) deletes their Personal Expenses; deleting the trip deletes all of them.

### Activity (phase 5: Activity 21)

| # | Method & path | Role | Body → Response |
| --- | --- | --- | --- |
| B39 | `POST /api/trips/:tripId/activity/read` | any | `{ ids?: string[] }` (empty = all) → `204` (adds the User to `readBy`) |

The "ตรวจและยืนยัน" button on a settlement activity calls B33.

### Auth (phase 5: Login 19, `src/proxy.ts`)

| # | Method & path | Role | Notes |
| --- | --- | --- | --- |
| B40 | `GET /api/auth/line` · `GET /api/auth/google` | public | Start OAuth; `?next=` is kept for the redirect back |
| B41 | `GET /api/auth/:provider/callback` | public | Find or create the User (name, email, picture only), set the session cookie, redirect to `next` |
| B42 | `POST /api/auth/logout` | signed in | Bump the User's `sessionVersion` (all their session cookies stop working) and clear the cookie → `204`. Without a session still `204`. |
| B43 | `POST /api/dev/login` | dev only | `{ userId }` → sets `mock-user` (replaces `switchMockUser` and the mock Login buttons); 404 in production |

### Admin (screens 23-27, `/admin`)

All under `/api/admin`. Role: **admin** = signed-in User whose id is in env `ADMIN_USER_IDS` (docs/adr/0002). Signed out → `401`; any other User → `404 not_found` (never `403`). Read-only except sign-out. Personal Expenses, personal checklist items and Documents are never returned. Dates are ISO strings, money is satang. `Page<T>` = `{ items: T[], page, pageSize: 20, total }`; bad query values → `400`.

Shared shapes:
- `AdminUserRow` = `{ id, name, email, provider: "google"|"line", color, avatarUrl?, tripCount (active memberships), createdAt, lastSeenAt: string|null }`
- `AdminTripRow` = `{ id, name, destination, startDate, endDate, cover, status: "upcoming"|"ongoing"|"past" (dates vs today in Asia/Bangkok), owners: { memberId, name (Member displayName), userId: string|null }[] (active owners), memberCount (active), spent (sum of Expense amounts, no Personal Expenses) }`

| Method & path | Role | Query → Response |
| --- | --- | --- |
| `GET /api/admin/whoami` | admin | → `{ user }` (same shape as `/api/me`) |
| `GET /api/admin/overview` | admin | `?days=7\|30\|90` (default 30) → `{ totals: { users, trips }, kpis: { usersNew, tripsNew, activeTrips7d, signups7d }` (each `{ current, previous }`; `previous` is the window before; the two `7d` ones are always 7 days), `daily: { date, users, trips }[]` (Bangkok dates, `days` long, oldest first, zero-filled), `providers: { google, line }, usersInTripPct, avgMembersPerTrip, recentUsers: AdminUserRow[5], busiestTrips: (AdminTripRow & { activity7d })[≤5] }` |
| `GET /api/admin/users` | admin | `?q=&provider=google\|line&sort=createdAt\|lastSeenAt\|name&dir=asc\|desc&page=1` (default `createdAt desc`; `q` = name or email contains) → `Page<AdminUserRow>` |
| `GET /api/admin/users/:id` | admin | → `{ user: AdminUserRow & { sessionVersion }, trips: { id, name, startDate, endDate, cover, status, memberCount, role }[], activity: { id, tripId, tripName, type, text, createdAt }[10] }`; unknown → `404` |
| `POST /api/admin/users/:id/signout` | admin | → `204`. Bumps `sessionVersion` (all devices). Own id → `409 cannot_sign_out_self`; unknown → `404`. Logs `admin_force_signout`. |
| `GET /api/admin/trips` | admin | `?q=&status=upcoming\|ongoing\|past&sort=startDate\|createdAt&dir=asc\|desc&page=1` (default `startDate desc`; `q` = trip name, destination, or an owner's Member displayName / User name contains) → `Page<AdminTripRow>` |
| `GET /api/admin/trips/:id` | admin | → `{ trip: AdminTripRow & { createdBy: { id, name } \| null }, members: { id, displayName, role, userId, color, status }[], counts: { places, planItems, expenses, settlements, checklistItems (group only), activity7d }, activity: { id, actorName, type, text, createdAt }[5] }`; unknown → `404` |
| `GET /api/admin/system` | admin | `?filter=all\|4xx\|5xx\|slow&page=1` → `{ api: { uptimeSec, p95Ms1h: number\|null }, mongo: { ok, pingMs: number\|null, collections }, storage: { driver }, rateLimit: { blocked24h }, errorsByHour: { hour, c4xx, c5xx, total (all logged requests that hour) }[24], logs: Page<{ id, at, method, path, status, ms, userId: string\|null }> }` (newest first; slow = `ms >= 500`; stats come from the capped `requestLogs`; if MongoDB is down still `200` with `mongo.ok: false` and empty stats) |

Trip detail `members` includes pending Members (with their `status`) and leaves out removed ones. The 24h stats (`errorsByHour`, `blocked24h`, `p95Ms1h`) are computed from the capped `requestLogs`, so they only cover the last 1,000 logged requests and undercount on a busy day. Under `NODE_ENV=test` requests are not logged unless the app is built with `createApp(config, { recordRequests: true })`.

`User.lastSeenAt` is written when a session is accepted, at most every 10 minutes. `requestLogs` keeps the latest 1,000 requests, skipping `/api/health` and `/api/admin/*`, with no query string.

---

## Differences from SPEC's data model

These fields exist in `frontend/src/lib/api/types.ts` but not in SPEC. The backend should store them:
- `Expense.date`, `createdAt`, `updatedBy`, `updatedAt`, `cardLast4` (legacy), `cardName`, `note`
- `Settlement.createdAt`, `sentAt`, `confirmedAt`
- `ChecklistItem.done`
- `Activity.readBy`
- `Trip.meetingPoint`, `createdBy`
- `Member.color`, `User.color`
- `Place.createdBy`
- Transit `fromCode`, `toCode`, `durationMinutes`, `seatInfo`, `fromPlaceId`, `toPlaceId`
- `Share.amount` is always present (the server resolves it).

## Open questions

- B6: what happens when removing a Member who still has Outstanding (SPEC open item). Proposed: 409 until settled.
- B17: deleting a Place that a Transit uses as an endpoint. Proposed: 409.
- B32: a viewer may report any amount, also partial, as long as the total of their `sent` reports stays within their Outstanding (decided 2026-11-12, BUG-B6). The receiver must be owed money; an Unclaimed Member who is owed money may receive (decided 2026-11-12, revised the same day).
- Timezones for Transit (`LocalDateTime` + `durationMinutes` is a stopgap; SPEC open item).
- Whether A2's `outstanding` field should also be added to the frontend type, or computed in `lib/api`.
