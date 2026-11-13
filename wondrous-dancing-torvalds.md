# Personal Expense (ค่าใช้จ่ายส่วนตัว)

## Context
Today the expenses tab only records group Expenses, which are split into Shares and feed into balances and Settlements. People also want to log money they spend on themselves, such as souvenirs or shopping. They want to see how much the trip cost them in total, and to add a "ช็อปปิ้ง" category for this kind of spending. The design below was agreed in a grilling session.

## Decisions (from the grilling session)
1. **What it is:** a private record of money one Member spent for themself. Only that Member sees it (same rule as personal checklist items, `backend/src/models/checklist.model.ts:12`). It is **not** an Expense: it has no payer and no Shares. It does not count in the trip total, Net Balance, Outstanding, Suggested Transfers, Settlements, the Summary page or the Activity feed.
2. **Categories:** personal records use the 5 group categories plus `shopping` ("ช็อปปิ้ง"). Group Expenses keep their current 5 categories.
3. **Where it lives:** the expenses tab gets a Segmented switch, `กลุ่ม | ส่วนตัว` (`?view=personal`). The FAB adds whichever kind is showing.
4. **Personal header card:** "ทริปนี้ฉันใช้ ฿X", where X = my group share (`balances.rows[me].share`) + my personal total. Under it: "ส่วนในกลุ่ม ฿A · ส่วนตัว ฿B", then the personal total broken down by category.
5. **Fields:** amount, title, category, date, payment method, note. There is no payer, no split and no slip.
6. **Permissions:** any role, viewers included, can add, edit and delete their own records. Nobody else can see them, not even the trip owner. Another Member's record returns 404.

7. **Soft-removed Member:** their Personal Expenses are kept (invisible to everyone) until the trip is deleted. *(decided 2026-11-13)*
8. **Trip dates shortened:** existing Personal Expenses outside the new dates stay; only new writes and edits are checked against the trip dates. *(decided 2026-11-13)*

## Glossary: add to CONTEXT.md (Money section)
**Personal Expense**:
Money one **Member** spent only for themself, recorded so they can follow their own trip spending. Only that Member sees it. It has no **Shares** and never affects the group's money (**Net Balance**, **Outstanding**, **Settlements**).
_Avoid_: private expense, solo expense

## Backend (`backend/`, run by the `backend` agent)
- **Model and collection:** `personalExpenses`, with fields `{ tripId, ownerId, title, category, amount (satang), currency:'THB', baseAmount, method, note?, date, createdAt, updatedAt? }`.
  - Add a `$jsonSchema` validator in `db/schema.ts` and `db/validators.ts`, and the collection in `db/collections.ts`.
  - Index on `{ tripId, ownerId, date }`.
- **Category type:** `PersonalExpenseCategory = ExpenseCategory | "shopping"`. Add its Thai label in `domain/labels.ts`.
- **Routes:** `routes/personal-expense.routes.ts`, mounted at `/api/trips/:tripId/personal-expenses` behind requireUser + requireMember. Every query filters on `ownerId = me`.
  - `GET /` → my records
  - `POST /` → create
  - `PATCH /:id` → update
  - `DELETE /:id` → 204
- **Validation:** amount is an integer > 0, the date falls inside the trip, and the category is one of the 6.
- **Cleanup:**
  - When a Member is hard-deleted, `member.controller.ts:removeMember` also deletes their personal records (like `removeMemberFromChecklist`).
  - Deleting a trip also deletes its personal records (follow the existing cascade).
- **Seed:** add a few personal records for Act on one trip in `seed/data.ts`.
- **Tests:** `routes/personal-expenses.test.ts`:
  - CRUD works
  - a viewer can create a record
  - another Member's record returns 404 on GET/PATCH/DELETE
  - group balances and the total are unchanged after adding personal records
  - invalid category or amount returns 400
- **Docs:** add rows B44–B47 to `docs/api/API.md`, and add the model to the data-model section of `docs/design/SPEC.md`.

## Frontend (`frontend/`, run by the `frontend` agent)
- **Types:** add `PersonalExpense` and `PersonalExpenseCategory` to `lib/api/types.ts`. Add `getPersonalExpenses(tripId)` to `lib/api/queries.ts`, plus actions in a new `lib/api/personal-expense-actions.ts` (create/update/delete, then `revalidatePath`).
- **Colors and labels:** add a `shopping` entry to `expenseCategoryStyle` in `components/ui/colors.ts` (label "ช็อปปิ้ง", abbr "ช็อป") and to `expenseCategoryFormLabel` in `lib/labels.ts`, using existing tokens only.
- **Pure helpers:** in `lib/expenses.ts`, add `personalTotals(records)` → `{ total, byCategory }`. Reuse `groupExpensesByDay` for the day list, and make it generic over `{ date, amount }` if needed.
- **Page:** `(tabs)/expenses/page.tsx`:
  - read `searchParams.view`
  - add a Segmented switch built from Links (keep it a server component)
  - group view stays as it is today
  - personal view shows the header card from decision 4, a list by day (row: category chip, title, method, amount), and an empty state
  - the FAB links to `expenses/personal/new`
- **New pages:** `expenses/personal/new/page.tsx` and `expenses/personal/[id]/page.tsx` (edit, with delete through `ConfirmDialog`). The form is a new small `components/expenses/PersonalExpenseForm.tsx` with the fields from decision 5. Reuse the field styles and amount input from `ExpenseForm.tsx`.
- **Tests:** `personalTotals` in `lib/expenses.test.ts`, and a form check in a `lib/personal-expense-form.ts` test.

## Order: agent tasks
Each task gets a **fresh agent** (memory: fresh agent per task). Start the next task as soon as its inputs are ready, without stopping to ask (memory: MVP chain phases). Small issues go into a "ค้างไว้แก้ทีเดียว" list and are fixed together at the end. Every agent reads this file first. None of them commits.

| # | Agent | Task | Needs | Output |
| --- | --- | --- | --- | --- |
| T0 | me | Add **Personal Expense** to CONTEXT.md | — | ✅ done |
| T1 | `mongo-schema-designer` | Design the `personalExpenses` collection: fields, `$jsonSchema`, index `{tripId, ownerId, date}`, cleanup when a Member or Trip is deleted, and why it is a separate collection rather than a flag on Expense. Check it against the backend's current schema/validators. | T0 | `docs/db/schema.md` section + a short list of things the backend must change |
| T2 | `backend` | Build the "Backend" section above: model, routes B44–B47, validation, cleanup, seed, tests, API.md and SPEC.md. An earlier agent was stopped partway: its files are still in the tree (`personal-expense.*` in controllers/models/routes/schemas/views, plus edits to app.ts, member.controller.ts, collections.ts, validators.ts, labels.ts, trip.model.ts, schemas/models.ts, seed/data.ts). Review that work and finish it; don't start over. When T1 finishes, send it T1's list (SendMessage) so it can fix any differences. | T0 (T1 to reconcile) | API working + `personal-expenses.test.ts` passing; reports the response JSON shape |
| T3 | `qa-api` | Black-box test B44–B47 against API.md: status codes, response shape, privacy (another Member → 404, the owner can't see others' records), viewer can CRUD own records, 400 cases, group total/balances/settlements unchanged, cleanup when a Member is removed. | T2 | `backend/src/qa/personal-expenses.qa.test.ts` + bugs in `docs/qa/api-report.md` |
| T4 | `backend` (fresh) | Fix any T3 bugs (Critical/High). Skip if there are none. | T3 | tests green |
| T5 | `frontend` | Build the "Frontend" section above, using the JSON shape reported in T2: types, query/actions, ช็อปปิ้ง style, `personalTotals`, Segmented switch, personal view and header card, new/edit pages, tests. lint, tsc, test and build must pass. | T2 (can start in parallel with T3) | screens done |
| T6 | `qa-senior` | End-to-end in the browser at mobile width, using the "Verification" scenarios below: Adam adds ฿3,000 shopping, group numbers unchanged, other members can't see it, a viewer adds own record, edit/delete with confirmation, empty state, ทริปนี้ฉันใช้ total is correct. Also regression-check the group expenses tab and Summary. | T4 + T5 | `docs/qa/app-report.md` section |
| T7 | `frontend` / `backend` (fresh) | Fix T6 bugs and the ค้างไว้แก้ทีเดียว list. Then run a short `qa-senior` recheck of the fixed items only. | T6 | all green |
| T8 | me | Final check: all test suites, a quick look in the browser, summary to the user. Commit only if the user asks. | T7 | — |

How tasks overlap: T1 runs in parallel with T2. T3 and T5 run in parallel once T2 is done. T6 waits for both T4 and T5.

## Verification
- Backend: `npm test` in `backend/`, with the new tests passing and the existing money tests unchanged.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`.
- In the browser at mobile width (localhost:3000, Osaka 2027):
  - As Adam, add "ของฝาก Don Quijote", ฿3,000, ช็อปปิ้ง. It appears under ส่วนตัว, and the header card adds it to my group share.
  - The group view's total and Outstanding stay the same.
  - Switch to another member: Adam's record is not visible.
  - As a viewer, you can add your own record.
  - Edit and delete the record, with the confirmation dialog.
