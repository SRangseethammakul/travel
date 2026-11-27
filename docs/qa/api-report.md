# API QA report — phases 1–3 (+ early money tests)

Last run: 2026-11-12 · Owner: qa-api (phases 1–3). Phases 4–5 (money, checklist, documents, OAuth) are now owned by a second QA pass → `docs/qa/api-report-phase4-5.md` (BUG-B<n>). Money tests written before that split are kept here (BUG-2, BUG-3) and no more were added.

## Scope

- **Scope note:** the checkboxes in `first-backend.md` don't match what is built. Only a few items are ticked (phase 1 setup/config/schemas/money domain, phase 2 "route + shape alignment"), but `app.ts` mounts every router from phases 1–5. Scope was taken from the mounted routes, limited to phases 1–3 after the split.
- Covered: auth (401), non-Member → 404 on every trip endpoint, pending/removed Member = non-Member, viewer 403 on every write, editor 403 on owner-only actions, error shape + Thai message, trips CRUD + delete cascade, Members (add / role / remove / last owner / Outstanding ≠ 0 / soft remove + no rejoin), invites (1d/7d/never, reset), Join preview, Claim (incl. concurrent Claim race), approval flow, Places (filters, CRUD, role matrix, transit-endpoint 409), Areas, Tags (owner-only edit, delete removes from every Place, suggest), Plan (sorting, multi-day add, transits, Hops, role matrix), City Legs, Activity per write for phases 2–3.
- Also (before the split): Expenses (validation, splitting, role matrix, balances after add/edit/delete) and Settlements (state machine, roles, races, Tokyo end-to-end).
- Live stack smoke (read-only curl, Docker MongoDB 9.0.8): health, 401, non-Member 404, editor 403 on invite, Tokyo balances, B22 usage path, plan sort, malformed JSON. All matched the memory-server results (mongodb-memory-server uses mongod 8.2.6). No behaviour differences seen between the two. No live data was changed, so no re-seed was needed.

## Results

Tests in `backend/src/qa/`: `auth.qa.test.ts`, `members.qa.test.ts`, `places-plan.qa.test.ts`, `expenses.qa.test.ts`, `settlements.qa.test.ts` (+ `qa-helpers.ts`).
`npm test`: 419 tests, **414 passed, 5 failed** (all 5 are the bugs below). `npm run lint` and `npx tsc --noEmit` pass.

## Bugs

### BUG-1: calendar dates are only checked with a regex, so impossible dates are stored — FIXED
- **Fixed (backend):** `schemas/common.ts` `IsoDate` = `z.iso.date()` (real calendar days, leap-year aware); `LocalDateTime` now also rejects impossible dates and hours/minutes (e.g. `25:99`). Applies to every field that uses them.
- Severity: medium (wrong status; bad data in the Expense list grouping and trip day count)
- Endpoint: `POST /api/trips/:tripId/expenses` as editor; `POST /api/trips` as any signed-in User (also any other `IsoDate` field, e.g. `PATCH` trip, Expense `date`)
- Expected: 400 `{ error }`. first-backend.md "Schema": วันที่ปฏิทินเป็น string `YYYY-MM-DD`. API.md Conventions: Dates are `ISODate`. `2026-13-45` and `2027-02-30` are not calendar dates.
- Actual: `201` with `"date":"2026-13-45"`; `201` with `"startDate":"2027-02-30"` (`schemas/common.ts` `IsoDate` = `/^\d{4}-\d{2}-\d{2}$/`)
- Test: backend/src/qa/expenses.qa.test.ts:183, backend/src/qa/members.qa.test.ts:93

### BUG-2: concurrent "report transfer" requests create two open Settlements for the same pair — FIXED
- **Fixed (backend):** new unique partial index `settlements_open_pair` `{ tripId, fromId, toId }` where `status: 'sent'`; `POST /settlements` maps E11000 to `409 already_sent`. Built by `ensureSchema` at startup (live DB checked: no existing duplicates). Still rests on the undecided "one open Settlement per pair" rule (spec question 7).
- Severity: high (money: the payer can be credited twice)
- Endpoint: `POST /api/trips/:tripId/settlements` as editor (Ploy → Act)
- Expected: one `201`, the rest `409 already_sent`. This is the backend's own interim rule ("one open transfer per pair", `settlement.controller.ts`), and first-backend.md asks for conditional writes on every Settlement step. The concurrent-Claim race is handled the same way.
- Actual: `[201, 201, 409, 409, 409]`: two `sent` Settlements of ฿5,150 each. The check (`findOpenSettlement`) and the `insertOne` are separate steps with no unique index. If Act confirms both, Ploy's Outstanding becomes +฿5,150.
- Test: backend/src/qa/settlements.qa.test.ts:94 (10 rounds × 5 parallel requests; fails in round 1–2 every run)
- Note: phase 4 is now with the other QA agent. Hand this over / cross-reference as needed.

### BUG-3: Suggested Transfer loses its open Settlement after a partial transfer — FIXED
- **Fixed (backend):** `balancesView` matches the non-confirmed Settlement by payer → receiver pair, not amount (unambiguous because of `settlements_open_pair`). Note: the frontend mock (`frontend/src/lib/api/queries.ts`) still matches by exact amount.
- Severity: medium (wrong shape → UI shows "ยังไม่โอน" while a transfer is waiting for confirmation, and re-reporting gives 409)
- Endpoint: `GET /api/trips/:tripId/balances` as any Member
- Expected: API.md A14 says `transfers` come "each with the matching non-confirmed Settlement if one exists". After Ploy reports ฿1,000 of her ฿5,150, the Ploy → Act transfer should carry that `sent` Settlement.
- Actual: `settlement: null`. `balancesView` matches only when `s.amount === t.amount`.
- Test: backend/src/qa/settlements.qa.test.ts:224
- (Also listed as spec question 6: "matching" is not defined for partial amounts.)

### BUG-4: B22 tag usage endpoint does not exist at the documented path — FIXED (docs)
- **Fixed (docs):** the frontend calls `getTagUsage(userId): Record<ID, number>` (`frontend/src/lib/api/plan-queries.ts`), which is what `GET /api/me/tags/usage` returns. API.md B22 and docs/db/schema.md were updated to that route; the QA test at places-plan.qa.test.ts:159 now expects `{ [tagId]: count }`.
- Severity: medium (route/shape differs from the contract)
- Endpoint: `GET /api/me/tags/:tagId/usage` as the tag owner
- Expected: `200 { places: number }` (API.md B22, docs/db/schema.md B22)
- Actual: `404 {"error":{"code":"not_found",...}}`. The backend instead serves `GET /api/me/tags/usage` → `{ [tagId]: count }` for all my tags. The change isn't recorded in any doc. Confirmed on the live stack too.
- Test: backend/src/qa/places-plan.qa.test.ts:159

## Spec questions (documents disagree or are silent)

1. **first-backend.md checkboxes are stale:** most phase 1–5 items are unticked but implemented and tested. Tick them, or say which ones are not done.
2. **Area rename/merge role:** API.md B23 says `editor+`; first-backend.md "สิทธิ์" says owner only. The backend follows first-backend.md (higher precedence), which is correct. API.md should be updated.
3. **"Every write adds an Activity" vs. writes with no trip or private writes:** Tag create/rename/delete (`/api/me/tags`) adds no Activity, even though deleting a Tag changes Places in every trip. Personal checklist changes and `DELETE` trip add none either. Decide whether these are exceptions.
4. **Viewer visibility of balances:** SPEC "ดูอย่างเดียว: ดูแผนและยอดของตัวเอง" (own balance) vs first-backend.md "viewer: อ่าน" (read). The backend returns every Member's balances, Expenses and summary to viewers.
5. **Viewer as receiver:** the rules say viewers may only *report* Settlements as payer, and say nothing about confirming money they receive. The backend lets any receiver confirm, viewers included. That seems necessary, but it should be written down.
6. **Partial / off-suggestion transfers (B32):** API.md open question proposes "any amount up to their Outstanding". The backend also accepts a transfer to a Member who is owed nothing (e.g. Ploy → Mint while Mint's Outstanding is 0). Once confirmed, that pushes Mint negative. Also define how `transfers[].settlement` matches a partial Settlement (BUG-3).
7. **One open Settlement per pair:** still undecided in first-backend.md ("ยังไม่ตัดสินใจ"). The backend enforces it, but not atomically (BUG-2). If kept, a unique partial index `{ tripId, fromId, toId }` where `status: 'sent'` is what schema.md already suggests.
8. **`TripDocument.fileKey`:** `frontend/src/lib/api/types.ts` includes it, but the backend view omits it, rightly, because files must only be reachable via signed URLs. types.ts should drop it. (Phase 5, for the other QA pass.)
9. **Extra response fields:** Member responses include `status`, `createdAt` (and `claimedAt` after a Claim); `GET /api/join/:token` adds `requireApproval`; `POST /api/join/:token` returns `200`, not `201`. All harmless, but not in types.ts or API.md.
10. **Plan days after changing trip dates:** `PATCH` trip can shorten the trip. City Legs are re-checked against the new length, but Plan Items are not. Nothing says what should happen to Plan Items beyond the new last day.

## No coverage yet (phases 1–3)

- `GET /api/trips?tab=` against a fixed clock (the server uses the real date; only the upcoming/past split is checked).
- Place grouping (`?group=area|type`) response shape, which has no type in types.ts.
- Activity paging (`before`, `limit`) and `POST /activity/read`. These are phase 4, now with the other QA pass.
- Phase 1 schema validators / indexes (`db/schema.test.ts` covers them; not re-tested black-box).
- Rate limiting and security headers (phase 5).

## Personal Expenses (B44–B47) — 2026-11-13

Owner: qa-api (task T3 in `wondrous-dancing-torvalds.md`). Sources: API.md "Personal Expenses (ค่าใช้จ่ายส่วนตัว)", CONTEXT.md "Personal Expense", docs/db/schema.md Personal Expense section.

**Tests:** `backend/src/qa/personal-expenses.qa.test.ts`, 56 tests, **56 passed**. Full `npm test`: 29 files, 639 tests, all passed. `npm run lint` and `npx tsc --noEmit` pass.

**Covered:**
- Shape: `id` (not `_id`), `tripId`, `ownerId` = Current Member, `currency: 'THB'`, `baseAmount = amount`, `YYYY-MM-DD` date, ISO `createdAt`, `updatedAt` only after PATCH, no `note` key when unset, no payer/Shares/slip. POST 201, PATCH 200, DELETE 204 with an empty body. A second DELETE → 404.
- Sort: by `date`, then `createdAt` (same-day records stay in insert order).
- Auth: signed out → 401 on all 4 endpoints. Non-member, `pending` and `removed` Members, and unknown trips → 404.
- Privacy: other Members' GET never includes my records, including the trip owner's. Owner, editor or viewer PATCH/DELETE on someone else's record → 404 `personal_expense_not_found`, and the record is unchanged. That 404 body is identical to the one for an unknown id. My own record from another trip, used via this trip's path → 404. A Personal Expense id under `/expenses/:id` → 404. `ownerId` in the body → 400.
- Viewer: creates, edits and deletes their own records; gets 404 on the owner's.
- 400 cases: bad or wrong-type category; bad method; amount 0, negative, 1.5, `"100"` or over ฿20,000,000; missing, blank or 201-char title; note over 2000 characters; date as `2026/12/13`, `2026-02-30` or missing; date one day before or after the trip (`date_outside_trip`, on both POST and PATCH); server-owned fields (`tripId`, `currency`, `baseAmount`, `id`, `createdAt`, `payerId`); malformed JSON; empty PATCH; invalid PATCH fields, with nothing changed afterwards. Boundaries that are accepted: amount 1 and ฿20,000,000, the first and last trip days, a 200-char title, and all 6 categories. Group Expense POST or PATCH with `shopping` → 400.
- Group money: snapshots of `/expenses`, `/balances` (total ฿30,350, Net, Outstanding, Suggested Transfers), `/settlements`, `/summary`, `/activity`, the Activity count and the trip itself are deep-equal before and after these steps: add (by owner, editor and viewer, including a ฿20M record), edit, and delete a seed record. Each Member's own `/balances` view is also unchanged.
- Cleanup:
  - A hard-deleted Member (N, viewer, no Expenses) loses their records. Other Members' records stay, and so do N's records in another trip.
  - A soft-removed Member (Mint, who is referenced by Expenses and has Outstanding 0) keeps their records in the DB, but gets 404 on GET and POST.
  - Deleting a trip removes all of its records and leaves other trips' records alone.

**Bugs:** none found.

**Spec questions (Personal Expenses):**
11. **Soft-removed Member's records:** the task says "removing a Member deletes their records". The backend and schema.md (open question 11) delete them only on a hard delete. On a soft remove, which happens whenever the Member appears in an Expense or Settlement, the records are kept but nobody can see them. This matches the documented proposal. API.md says "(hard delete)", so the documents agree, but it should be confirmed as the final decision.
12. **Empty note:** `note: ""` is accepted and stored as an empty string, and `note: null` on POST → 400. Only PATCH accepts `null`. Decide whether `""` should be treated as "no note".
13. **Title whitespace:** `title` is trimmed and inner whitespace is collapsed (same `label()` as Places). API.md doesn't mention this.

**No coverage:** a Claimed Unclaimed Member's records (an Unclaimed Member can't sign in, so it can't own records today); concurrent edits of the same record; live-stack curl (not run in this pass).

---

## Admin API (`/api/admin/*`) — QA pass, branch `feat/admin-dashboard`

Tests: `backend/src/qa/admin.qa.test.ts` (80 tests, 77 pass, 3 fail on purpose). Sources: API.md "Admin", SPEC "ผู้ดูแลระบบ (Admin)", ADR 0002, schema.md. Full backend suite: 788 tests, 785 pass, 3 fail (all ADMIN-BUG tests in this file). `eslint` and `tsc --noEmit` are clean.

**Checked and passing:** 401 signed out / 404 `not_found` for non-admin on every route including POST, DELETE, PATCH and unknown sub-paths; unset, empty, whitespace and comma-only `ADMIN_USER_IDS` admit nobody (via `loadConfig`); Personal Expenses and Personal checklist items change none of `spent`, overview, counts, activity (deep-equal snapshots of 12 admin responses); no `providerSubject`, `token`, `fileKey`, documents or shares in any response; paging (past the end, `page=0/abc/-1/1.5`, repeated params → 400), sort/dir, provider/status filters, regex metacharacters in `q`, owner search by Member displayName and User name, owners = active owner Members only (several owners, unclaimed owner, removed/pending excluded); trip status around the Asia/Bangkok boundary (fake clock at 16:59 and 17:30 UTC); force sign-out (204, version +1, old signed cookie then 401, re-login works, self 409, unknown/non-admin 404, other admin allowed, concurrent calls); request log skips `/api/health` and `/api/admin/*`, never stores a query string, cap 1000, failed or throwing write does not fail the request; `lastSeenAt` set once, not rewritten within 10 min, rewritten after 11, not set by a 401; `/system` 24 buckets, counts, slow = `ms >= 500`, filters, paging, p95, Mongo-down → 200.

### ADMIN-BUG-1: request log records `/API/ADMIN/*`, `/API/HEALTH` and `/api/health/` (FIXED)
- Severity: low
- Endpoint: any `GET /API/ADMIN/users` (admin), `GET /API/HEALTH`, `GET /api/health/`
- Expected: API.md "skipping `/api/health` and `/api/admin/*`". Express matches routes case-insensitively and ignores a trailing slash, so these are the same routes.
- Actual: `shouldRecordRequest` compares the raw path with `===` / `startsWith`, so these requests are stored in `requestLogs` (admin reads fill the log with themselves, and health probes with a trailing slash add noise).
- Repro: createApp with `recordRequests: true`; `GET /API/ADMIN/users` as admin; `requestLogs` has an entry with that path.
- Test: backend/src/qa/admin.qa.test.ts:610
- Fix hint: lower-case the path and strip a trailing slash before comparing (`src/utils/request-log.ts`).

### ADMIN-BUG-2: requests with a path over 500 characters are silently not logged (FIXED)
- Severity: low
- Endpoint: any, e.g. `GET /api/aaaa…(600)`
- Expected: "`requestLogs` keeps the latest 1,000 requests". Every request should have an entry (probing with long URLs is exactly what an admin wants to see).
- Actual: the `requestLogs` validator has `path` maxLength 500, the insert fails, and `.catch(() => undefined)` hides it. No entry, no error.
- Test: backend/src/qa/admin.qa.test.ts:687
- Fix hint: truncate `path` to 500 before insert.

### ADMIN-BUG-3: `rateLimit.blocked24h` misses 429s in the oldest partial hour (FIXED)
- Severity: low
- Endpoint: `GET /api/admin/system` as admin
- Expected: "`blocked24h` counts 429s" in the last 24 hours (API.md; task: blocked24h counts 429s).
- Actual: `requestLogsSince(hours[0], …)` starts at the start of the oldest hourly bucket (`floor(now − 23h)`), but `blocked24h` filters on `now − 24h`. A 429 from 23.5 h ago at 10:10 is before 11:00 the previous day, so it is not counted. Up to 1 hour of the window is lost (the 24 h window is really 23–24 h).
- Repro: fake `Date` to 10:10; insert a 429 log dated now − 23.5 h; `blocked24h` is 0, expected 1.
- Test: backend/src/qa/admin.qa.test.ts:828
- Fix hint: query from `min(hours[0], now − 24h)`.

### Spec questions (Admin)
1. **Trip detail `members`:** `listTripMembers` returns active and pending Members and hides removed ones. API.md only says `members: {…status}[]`. The `status` field suggests all statuses may be wanted; confirm that removed Members should be hidden from the admin view.
2. **Out-of-window logs:** the 1,000-request cap means `errorsByHour` and `blocked24h` undercount on a busy day (older rows are overwritten). Fine for an MVP, but the UI should not present them as exact.
3. **Test environment:** `createApp` skips request logging unless `recordRequests: true` or `NODE_ENV != test`. Documented in code, not in API.md or schema.md.

**Not covered:** live :4000 stack beyond one 401 curl (admin ids there are unknown to this pass; per instructions the server was not touched); load/race on the real 1,000-row cap while writing; real-time rate-limiter 429s (the test is best-effort and returns early if the limiter does not trip).
