# API QA report — phases 4–5 (money, checklist, documents, activity, login)

Date: 2026-11-12 · Tester: qa-api (phases 4–5; phases 1–3 are in `api-report.md`)

## Scope

- **Phase 4:** Expenses (PATCH side effects, removed Members), Settlements (who can receive, viewer flow, side effects), Summary (`byCategory`, per-Member items), Activity (`?type=`, paging, validation, `read`).
- **Phase 5:** Checklist (group/personal privacy, roles, templates, validation), Documents (upload, mime sniffing, size limit, signed URLs and real expiry, delete rules), LINE/Google OAuth, session cookie, production switches, rate limits, security headers.
- Existing suites (`expenses.qa`, `settlements.qa`, `auth.qa`, `routes/phase5.test.ts`, `routes/activity.test.ts`) already cover the Tokyo numbers, expense role matrix, settlement transitions and races, and the Google happy path. These tests fill the gaps and don't repeat them.

Note: every phase 4–5 item in `first-backend.md` is still `- [ ]`, but the code is built. Tested at the team lead's request (see spec question Q1).

## Test files

| File | Tests | Failing |
| --- | --- | --- |
| `backend/src/qa/money.p45.qa.test.ts` | 34 | 3 (BUG-B1, B2, B3) |
| `backend/src/qa/checklist.p45.qa.test.ts` | 31 | 3 (BUG-B4 ×2, B5) |
| `backend/src/qa/documents.p45.qa.test.ts` | 18 | 0 |
| `backend/src/qa/auth.p45.qa.test.ts` | 27 | 0 |
| `backend/src/qa/ratelimit.p45.qa.test.ts` | 2 | 0 |
| `backend/src/qa/p45-helpers.ts` | harness | — |

Total: 112 tests, 106 pass, 6 fail (all marked `// BUG-B<n>`). Full `npm test`: 531 tests, 525 pass, and the 6 failures are the ones listed here. `npm run lint` and `npx tsc --noEmit` pass.

**Update 2026-11-12 (after fixes):** all 5 bugs are fixed. Full `npm test`: 531 tests, 531 pass, 0 fail.

**Update 2026-11-12 (user decisions):** Q4(c) became BUG-B6 and is fixed; Q6 (viewer sees only own balance) and Q7 (logout revokes the session on the server) are implemented; Q4 "one open Settlement per pair" is now a decided rule. Full `npm test`: 559 tests, 559 pass.

**MongoDB 9 vs memory server:** `QA_LIVE_MONGO_URI=mongodb://localhost:27017 npx vitest run src/qa/*.p45.qa.test.ts` runs the same suites against the live mongod 9.0.8 (each in its own `tp-qa-p45-*` database, dropped afterwards). The results match the memory server (mongod 8.2.6): the same failing tests, and nothing else differs. curl checks on the live backend (:4000, using a trip created and then deleted for the check) reproduced BUG-B1, BUG-B4 and BUG-B5.

## Bugs

### BUG-B1: A Settlement can be reported to a pending Member
- Status: **FIXED** (2026-11-12): receiver must be an `active` Member (`findActiveTripMember` in settlement.controller) → 400.
- Severity: high (money / permission)
- Endpoint: `POST /api/trips/:tripId/settlements` as any Member (editor tested)
- Expected: 400. A `pending` Member is not a Member yet. first-backend.md "Member มี status … requireMember ผ่านเฉพาะ active", and the Expense rules already refuse a pending payer or sharer.
- Actual: `201 {"toId":"tokyo-winter:n","status":"sent",…}`. The receiver can't confirm it (they get 404 on the trip) until approved, and if they are never approved the transfer stays `sent` for good. Cause: `findTripMember` only excludes `removed`.
- Test: backend/src/qa/money.p45.qa.test.ts:43

### BUG-B2: Old Expenses can't be edited after a Member in their Shares is soft-removed
- Status: **FIXED** (2026-11-12): PATCH also accepts the payer/sharers already on the Expense (`resolveFields` in expense.controller); newly added removed/pending Members still 400.
- Severity: medium (data stuck / wrong status)
- Endpoint: `PATCH /api/trips/:tripId/expenses/:expenseId` as owner
- Expected: 200 when only the title changes. first-backend.md "สิทธิ์" says soft remove happens precisely *because* Expenses still name the Member, and those Expenses must stay usable.
- Actual: `400 {"error":{"code":"unknown_member","message":"คนจ่ายและคนที่ร่วมหารต้องเป็นสมาชิกของทริปนี้"}}`. Every PATCH re-checks the stored payer and shares against active Members. DELETE still works.
- Test: backend/src/qa/money.p45.qa.test.ts:161

### BUG-B4: A group checklist item can be assigned to a pending Member
- Status: **FIXED** (2026-11-12): assignee must be an `active` Member on create and PATCH (`findActiveTripMember` in checklist.controller) → 400.
- Severity: medium (permission)
- Endpoint: `POST /api/trips/:tripId/checklist` (and `PATCH` with `assigneeId`) as editor
- Expected: 400. A pending Member is not in the trip yet (first-backend.md, Member status).
- Actual: `201 {"assigneeId":"tokyo-winter:n",…}`. Same cause as BUG-B1 (`findTripMember`).
- Test: backend/src/qa/checklist.p45.qa.test.ts:94 (POST), :99 (PATCH)

### BUG-B5: PATCH a checklist item with `{}` → 500
- Status: **FIXED** (2026-11-12): empty body is refused by `UpdateChecklistInput` → 400.
- Severity: medium (wrong status)
- Endpoint: `PATCH /api/trips/:tripId/checklist/:itemId` as any Member
- Expected: 400 (or a 200 no-op), in the `{ error: { code, message } }` shape. API.md "Conventions" lists only 400/401/403/404/409.
- Actual: `500 {"error":{"code":"internal","message":"เกิดข้อผิดพลาด"}}`. Server log: `MongoInvalidArgumentError: Update document requires atomic operators`. Also seen on the live stack.
- Test: backend/src/qa/checklist.p45.qa.test.ts:116

### BUG-B6: A sender can report more in total than they owe
- Status: **FIXED** (2026-11-12): spec question Q4(c) resolved by user decision. B32 now refuses a report when `amount` + the sender's other `sent` Settlements > −(their Outstanding) → 400 `amount_too_large` (rule in `reportableAmount`, `src/domain/money/settle.ts`). Parallel reports to different receivers are re-checked after insert; an over-limit report is deleted again (API.md B32).
- Severity: high (money)
- Endpoint: `POST /api/trips/:tripId/settlements` as any Member
- Expected: 400 once the total reported as sent would exceed what the sender owes.
- Actual (before the fix): Ploy owes ฿5,150, reports ฿5,150 to Act → 201, then ฿100 to Beam → 201.
- Test: backend/src/qa/money.p45.qa.test.ts:65 (updated to expect 400), backend/src/routes/settlements.test.ts ("total reported may not exceed what I owe", incl. a parallel race)

### BUG-B3: Activity paging skips items that share a `createdAt`
- Status: **FIXED** (2026-11-12): `before` alone is now inclusive (client dedupes by id); optional `beforeId` gives an exact cursor (activity.model, API.md A16).
- Severity: low
- Endpoint: `GET /api/trips/:tripId/activity?limit=&before=` as any Member
- Expected: walking the pages returns every Activity. first-backend.md "Activity: อ่านแบบแบ่งหน้า (limit 50 + cursor createdAt)".
- Actual: the list is sorted by `createdAt, _id` but the cursor is only `createdAt < before`. When several Activities share the last item's millisecond, the rest of them are never shown (`qa-same-1` is missing).
- Test: backend/src/qa/money.p45.qa.test.ts:266

## Related money bugs from the phase 1–3 pass (see `api-report.md`, not re-reported here)

- BUG-1: impossible Expense dates (`2026-13-45`) accepted. The team lead reports it fixed in the rebuilt backend.
- BUG-2 (high): concurrent `POST /settlements` for the same pair created duplicate `sent` Settlements (`settlements.qa.test.ts:94`). The team lead reports it fixed with the unique partial index `settlements_open_pair`. That index only covers one sender–receiver pair; over-reporting across *different* receivers (Q4c) is now BUG-B6, fixed.
- BUG-3: `/balances` showed `settlement: null` on a Suggested Transfer after a partial Settlement. The team lead reports it fixed.

## Spec questions

1. **Stale ticks:** every phase 2–5 item in `first-backend.md` is still `- [ ]` even though the endpoints exist. Please tick the finished ones so QA scope is clear.
2. **`TripDocument.fileKey`:** `frontend/src/lib/api/types.ts` declares `fileKey: string` (required), but the backend leaves it out of responses, which is correct for privacy. The type should drop it or make it optional. Likewise, `Activity.action` (`"confirm_settlement"`), `Document.createdAt` and `Member.status` are returned but are not in `types.ts`.
3. **Viewer confirming a Settlement:** (resolved 2026-11-12 — kept: the receiver may confirm whatever their role) SPEC's viewer row lists only "แจ้งโอนเงินได้", while API.md B33 says "self (receiver)" with no role limit. Today a viewer who is the receiver can confirm (test pins 200). This seems right, but SPEC should say so.
4. **Who may receive a Settlement:** resolved 2026-11-12 — (a) receiver must be owed money → 400 `receiver_not_owed`; (b) Unclaimed receiver is allowed when owed money (revised by the user 2026-11-12: they confirm after a Claim; `receiver_unclaimed` removed); (c) see BUG-B6. Tests in money.p45.qa.test.ts expect 400 for a receiver owed nothing and 201 for an Unclaimed receiver who is owed money. B32 checks only the sender's Outstanding. Today it accepts (a) a receiver who is owed nothing (Ploy → Mint), (b) an Unclaimed Member, who can never confirm until someone claims the name, and (c) several `sent` Settlements to different receivers whose total is more than the sender owes. In the live check, Act owed ฿500 and reported ฿100 + ฿500 (pinned by the test at money.p45.qa.test.ts:65). API.md's open question only covers partial amounts. Nothing in the sources allows sending more than you owe, so (c) is the strongest candidate to become a bug (BUG-B6).
5. **"ทุกการแก้ข้อมูลเพิ่ม Activity" vs privacy:** personal checklist changes add no Activity (intentional, so private items stay private). Checklist and document Activities use `type: "plan"` because `ActivityType` has no `checklist`/`document`. Confirm both are intended.
6. **Viewer and balances:** (resolved 2026-11-12 — viewer sees only own row/transfers in `/balances` and `/summary`, revised the same day: viewers see all Expenses in A11/A12 and all Settlements in A13) SPEC's viewer row says "ดูแผนและยอดของตัวเอง" (own balance). Today viewers see every Member's rows in `/balances` and `/summary`. Is "ของตัวเอง" meant as a restriction?
7. **Logout is stateless:** (resolved 2026-11-12 — logout bumps `sessionVersion`) the session is a signed `userId.expiry` cookie. Logout tells the browser to drop it, but a copied cookie keeps working for up to 30 days, and there is no server-side revoke. Accept this, or add a session store or version?
8. **Upload size error is 413**, which is not in API.md's status list (400/401/403/404/409). Add 413 and 429 (rate limit) to the conventions.
9. **Rate limits are per IP:** 30 uploads per 15 minutes per IP. Behind a proxy without `trust proxy`, or for a group on one NAT, everyone shares one bucket. Decide on the key (User id?) before production.

## Observations (not bugs)

- Live stack: seed Documents (`doc-flight`, …) point to `mock/tokyo/*.pdf` files that aren't in the uploads volume, so their signed URLs answer 404 `document_not_found`. This only affects the demo.

## No coverage yet

- Real LINE/Google endpoints (all provider calls are faked with a stubbed `fetch`). The LINE `verify` response is not checked for `aud`/`nonce` on our side; the code relies on LINE's verification.
- HEIC/WebP sniffing, and an upload of exactly 10 MB.
- Concurrency for checklist ticks and document deletes (only OAuth first-login was raced here; settlement races are in `settlements.qa`).
- Editing an Expense after a related Settlement is confirmed (open item in SPEC/first-backend.md).
- Trip delete removing uploaded files from disk (phase 2 area).
