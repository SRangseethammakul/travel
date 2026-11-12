# First backend — task list

Implement API ของ Travel Planner ใน `backend/` ด้วย Node.js + Express 5 + TypeScript + MongoDB แบ่ง 5 ช่วง **หยุดให้ตรวจทุกครั้งที่จบช่วง**

อ่านก่อนเริ่ม: `docs/design/SPEC.md` (สิทธิ์ เงิน โมเดลข้อมูล), `CONTEXT.md` (คำศัพท์), `first-frontend.md` (ข้อตกลงที่ใช้ร่วมกัน) — ลำดับเมื่อขัดกัน: SPEC > ไฟล์นี้ > first-frontend.md > `frontend/src/lib/api`

ทุกช่วงต้องผ่าน `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` ใน `backend/` ก่อนบอกว่าเสร็จ

**ลำดับงาน:** backend มาแทน `frontend/src/lib/mock` โดยที่ `frontend/src/lib/api` ไม่ต้องเปลี่ยน ดังนั้นเริ่มช่วง 1 ได้หลังจากตรวจช่วง 1 ของ frontend แล้ว ระหว่างนี้ใช้โมเดลข้อมูลใน SPEC เป็นสัญญา

---

## ข้อตกลงที่ตัดสินใจแล้ว (ใช้ทุกช่วง)

### Stack
- Node 22, npm, TypeScript strict, ES modules
- Express 5 (async handler โยน error เข้า error middleware ได้เลย)
- MongoDB ผ่าน driver ทางการ `mongodb` (ไม่ใช้ Mongoose) + `zod` validate ข้อมูลเข้าและเป็นที่มาของ type — เปลี่ยนได้ถ้าตรวจแล้วไม่เหมาะ
- Vitest + supertest + `mongodb-memory-server` สำหรับ test; dev ใช้ `MONGODB_URI` จาก env
- พอร์ต dev `4000`, CORS อนุญาต `http://localhost:3000` พร้อม credentials

### Schema (MongoDB)
แบบเต็ม (shape, validator, index, write path) อยู่ที่ `docs/db/schema.md` — ไฟล์นี้สรุปเฉพาะที่ต้องจำ

| Collection | ฝังไว้ข้างใน | อ้างอิง (id) | Index หลัก |
| --- | --- | --- | --- |
| `users` | — | — | `{ provider, providerSubject }` unique partial |
| `trips` | `legs` (City Leg) | `createdBy` → users | `_id` |
| `members` | — | `tripId`, `userId` (null = Unclaimed) | `{ userId, tripId }` unique partial (userId เป็น string), `{ tripId }` |
| `invites` | — | `_id` = `tripId` | `{ token }` unique |
| `documents` | — (metadata เท่านั้น ไฟล์อยู่ object storage) | `tripId`, `uploadedBy` | `{ tripId }` |
| `places` | — | `tagIds` → tags | `{ tripId, city, area }`, `{ tagIds }` multikey |
| `tags` | — | `ownerId` → users | `{ ownerId, name }` unique |
| `planItems` (`kind`: place / transit) | `travelToNext` (Hop) | `placeId`, `docIds`, `expenseId`, `fromPlaceId`, `toPlaceId` | `{ tripId, day, time }` |
| `expenses` | `shares` | `payerId`, `shares.memberId`, `slipDocId` | `{ tripId, date, createdAt }` |
| `settlements` | — | `fromId`, `toId`, `slipDocId` | `{ tripId, createdAt }` |
| `checklistItems` | — | `ownerId`, `assigneeId`, `doneBy` | `{ tripId, scope, ownerId }` |
| `activities` | `readBy` (User ids, ไม่เกินจำนวนสมาชิก) | `actorId`, `refId` | `{ tripId, createdAt: -1 }`, `{ tripId, type, createdAt: -1 }` |

- `_id` เป็น string ทุก collection (seed ใช้ id อ่านง่ายเหมือน frontend เช่น `act`, `tokyo-winter:act`; ของใหม่ใช้ ObjectId hex) API แปลง `_id` → `id`
- เงินเป็น BSON `int` (validator รับ `int`/`long`); zod จำกัดยอดไม่เกิน ฿20,000,000 เพื่อให้ driver เขียนเป็น int32 เสมอ ไม่กลายเป็น `double`
- วันที่ปฏิทินเป็น string `YYYY-MM-DD`; เวลาที่เกิดเหตุการณ์ (`createdAt`, `sentAt`, …) เป็น BSON `date`
- **ฝัง** เฉพาะของที่มีขอบเขตและอ่านพร้อมกันเสมอ: Share ใน Expense (ต้องเขียนพร้อมยอดรวมในครั้งเดียว), City Leg ใน Trip, Hop ใน Plan Item
- **แยก collection + อ้างอิงด้วย id**: Member (ต้องมี unique index `{ userId, tripId }` ซึ่งใช้กับ array ในเอกสารเดียวไม่ได้), Place, Tag (ใช้ข้ามทริป), Settlement, Checklist, Activity, Document, Invite (ไม่ให้ token หลุดไปกับข้อมูล Trip)
- ทุกอย่างอ้างคนด้วย `memberId` ไม่ใช่ `userId` → **Claim แก้แค่เอกสาร Member เดียว** ด้วย conditional update (`userId: null` ใน filter) จับซ้ำได้ 409 จาก matchedCount หรือ E11000 → ไม่ต้องใช้ transaction (ยังรอยืนยันปิดข้อในหัวข้อ "ยังไม่ตัดสินใจ")
- Member มี `status`: `active` / `pending` (รออนุมัติจากลิงก์เชิญ) / `removed` (ถ้าตกลงใช้ soft remove) — `requireMember` ผ่านเฉพาะ `active`; query หา Member ต้องมี `userId: { $eq, $type: 'string' }` เพื่อให้ใช้ partial index ได้
- Net Balance / Outstanding / Suggested Transfer: อ่าน members + expenses (projection `payerId`, `amount`, `shares`) + settlements ของทริปด้วย index ที่ขึ้นต้นด้วย `tripId` แล้วคำนวณใน `src/domain/money` (โค้ดเดียวกับที่ test ตัวเลขโตเกียว) — มี aggregation สำรองใน schema.md ถ้าทริปใหญ่มาก
- Settlement ทุกขั้นเป็น `updateOne` ที่ filter สถานะปัจจุบัน + คนที่มีสิทธิ์ เช่น ยืนยัน = `{ _id, tripId, toId: me, status: 'sent' }` ไม่ match → อ่านซ้ำแล้วตอบ 404 / 403 / 409; ผู้โอนแจ้งโอน = insert เป็น `sent` เลย (`pending` คำนวณจาก Suggested Transfer ไม่เก็บ)
- ลบ Tag: `$pull` จากทุก Place ก่อน (`modifiedCount` = จำนวนที่ตอบกลับ) แล้วค่อยลบ tag; ฝั่งอ่านข้าม `tagIds` ที่ไม่มี tag แล้ว
- ลบทริป: ลบ trip ก่อน แล้ว `deleteMany({ tripId })` ทุก collection + ลบไฟล์ — ทำซ้ำได้ ไม่ใช้ transaction; tag ไม่ถูกลบ
- Plan: เรียง "วัน → เวลา (ไม่มีเวลาไว้ท้าย) → ลำดับที่เพิ่ม" ในโค้ด (Mongo เรียง `null` ไว้หน้า) จึงเพิ่ม `createdAt` ใน Plan Item
- Activity: collection แยก ไม่ฝัง, อ่านแบบแบ่งหน้า (limit 50 + cursor `createdAt`), ยังไม่มี TTL

### ผู้ใช้และการเข้าสู่ระบบ
- dev (`NODE_ENV=development` หรือ test): อ่าน cookie `mock-user` = **User id** แบบเดียวกับ frontend (`act`, `mint`, `beam`, `ploy`, `n`) — เพื่อให้ frontend สลับมาใช้ API ได้ก่อนมี OAuth
- production: ปิด mock-user เด็ดขาด ใช้ session cookie (httpOnly, secure, sameSite=lax) หลัง LINE / Google OAuth (ช่วง 5)
- ทุก request หา Current Member จาก User + `tripId`; ไม่ใช่สมาชิก → 404

### สิทธิ์ (ตรวจที่ server ทุก endpoint ที่แก้หรือลบ)
- `owner`: ทุกอย่าง รวมจัดการสมาชิก ลิงก์เชิญ ลบทริป
- `editor`: เพิ่ม Place / Plan Item / Expense; แก้/ลบได้เฉพาะ Place / Plan Item (รวม Hop) / Expense ที่ `createdBy` เป็นตัวเอง — Plan Item จึงต้องมี `createdBy` (Member id)
- เปลี่ยนชื่อ/รวม Area และแก้ City Legs: owner เท่านั้น — City Legs แก้ผ่าน `PATCH /api/trips/:tripId` ทางเดียว (ไม่มี `PUT /legs`)
- นำสมาชิกออกเมื่อ Outstanding = 0 แต่ยังมี Expense/Settlement อ้างถึง → soft remove (`status: 'removed'`) คนนั้นกลับเข้าทริปเดิมไม่ได้ (409) — ตกลงแล้ว
- `viewer`: อ่าน และแจ้งโอน Settlement ที่ตัวเองเป็นผู้โอน
- เช็คลิสต์ `personal` กรองด้วย `ownerId` ใน query ที่ server

### เงิน
- สตางค์ (integer) ทุกที่; Expense มี `currency: 'THB'`, `baseAmount`
- ผลรวม Share ต้องเท่ายอดพอดี ไม่งั้น 400; เศษสตางค์ (equal / shares) รวมไว้กับผู้จ่าย ถ้าผู้จ่ายไม่ร่วมหาร ให้คนแรกในรายการ
- Net Balance / Outstanding / Suggested Transfer คำนวณสด ไม่เก็บ (นิยามตาม `CONTEXT.md`)
- Settlement: `pending` → `sent` (ผู้โอน) → `confirmed` (ผู้รับ) ห้ามข้ามหรือย้อน
- Settlement ที่ยังเปิด (`sent`) มีได้คู่ละ 1 รายการ (ผู้โอน → ผู้รับ) — ตัดสินใจ 2026-11-12, บังคับด้วย index `settlements_open_pair`
- ตัวเลขที่ test ต้องได้ (ทริปโตเกียว): รวม ฿30,350; Net Act +14,050 · Mint −3,100 · Beam −5,800 · Ploy −5,150; Outstanding Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150

### Tag
- Tag เป็นของ User (`ownerId`) ใช้ได้ทุกทริป เฉพาะเจ้าของแก้/ลบได้; ลบ tag = ถอดออกจากทุก Place (ตอบจำนวนที่กลับไปด้วย)

### เอกสาร
- dev: เก็บไฟล์ใน `backend/.data/uploads` เปิดผ่าน signed URL (HMAC + หมดอายุ) — ที่เก็บจริงยังไม่ตัดสินใจ

### API
- prefix `/api`, JSON, error รูปแบบเดียว `{ error: { code, message } }`
- ทุกการแก้ข้อมูลเพิ่ม Activity

---

## ช่วง 1 — ฐาน

- [x] สร้าง `backend/` (`package.json`, `tsconfig.json`, ESLint, สคริปต์ `dev` / `build` / `start` / `lint` / `test`)
- [x] เพิ่ม `backend/node_modules`, `backend/dist`, `backend/.data`, `backend/.env*` (ยกเว้น `.env.example`) ใน `.gitignore` ที่ root
- [x] `.env.example`: `MONGODB_URI`, `PORT`, `NODE_ENV`, `SESSION_SECRET`, `FILE_URL_SECRET`, `CORS_ORIGIN`
- [x] `src/config.ts` อ่านและ validate env ด้วย zod (ขาดค่าแล้วหยุดตั้งแต่สตาร์ต)
- [x] `src/db/` — MongoClient ตัวเดียว, ฟังก์ชันเอา collection แบบมี type, สร้าง collection พร้อม `$jsonSchema` validator (`strict` / `error`) และ index ตาม `docs/db/schema.md` (ทำซ้ำได้ตอนสตาร์ต)
- [x] test schema: validator ปฏิเสธเอกสารผิด (เงินเป็น double, enum ผิด, personal ไม่มี `ownerId`, Settlement `confirmed` ไม่มี `confirmedAt`), index ครบตามชื่อใน schema.md, `explain()` ของการหา Member ใช้ `members_user_trip` (IXSCAN)
- [x] `src/app.ts` + `src/server.ts` — JSON, CORS, cookie, error middleware, `GET /api/health` (เช็ค DB ด้วย)
- [x] `src/schemas/` — zod schema ของทุกโมเดลใน SPEC (+ User) รวม field ที่ schema.md เพิ่ม (`Member.status`, `User.providerSubject`, `PlanItem.createdAt`) และเพดานเงิน
- [x] `src/auth/` — middleware อ่าน `mock-user` ตอน dev/test, `requireUser`, `requireMember(tripId)`, `requireRole(...)`
- [x] `src/domain/money/` — `split` (ตรวจครบพอดี + เกลี่ยเศษ), `balance` (Net / Outstanding), `settle` (Suggested Transfer) + test ด้วยตัวเลขโตเกียว
- [x] `src/seed/` — seed 4 ทริปให้ตรงกับ `first-frontend.md` (+ สคริปต์ `npm run seed`)
- [x] test helper: memory server + seed ต่อ test file

**จบช่วง 1:** health ตอบ ok กับ DB จริง, test เงินผ่านด้วยตัวเลขโตเกียว, middleware สิทธิ์มี test, เช็คครบ 4 คำสั่ง → หยุดให้ตรวจ

## ช่วง 2 — ทริป สมาชิก และสิทธิ์

- [x] `GET /api/me`, `GET /api/trips?tab=upcoming|past` (แต่ละทริปมี Outstanding ของฉัน)
- [x] `POST /api/trips`, `GET /api/trips/:tripId`, `PATCH`, `DELETE` (owner) — DELETE ลบ trip ก่อนแล้ว `deleteMany({ tripId })` ทุก collection (ไม่ลบ tag)
- [x] Member: เพิ่ม (รวม Unclaimed Member), เปลี่ยนสิทธิ์, นำออก (owner) — นำออกตาม write path ใน `docs/db/schema.md` (Outstanding ≠ 0 → 409, owner คนสุดท้าย → 409)
- [x] Invite: สร้าง / หมดอายุ (1 วัน / 7 วัน / ไม่หมด) / ต้องอนุมัติ / รีเซ็ต token
- [x] Join + Claim: ดูตัวอย่างทริปจาก token, เลือก Unclaimed Member (บอกจำนวนรายการและยอดที่ผูก) หรือเพิ่มตัวเอง — Claim เป็น conditional update บน Member เดียว (`userId: null` ใน filter), ต้องอนุมัติ → `status: 'pending'`; test กดจับชื่อเดียวกันพร้อมกัน → 409
- [x] ปรับ route และรูปข้อมูลให้ตรงกับ `frontend/src/lib/api/*.ts` ที่เขียนไว้จริง แล้วสรุปส่วนต่างในรายงาน
- [x] test สิทธิ์ทุก endpoint: owner / editor / viewer / ไม่ใช่สมาชิก

**จบช่วง 2:** หยุดให้ตรวจรูปแบบ route, middleware และ error ก่อนทำ resource ที่เหลือ

## ช่วง 3 — สถานที่ Tag และแผน

- [x] Place: CRUD, กรอง `city` / `area` / `tags` / `unscheduled`, จัดกลุ่มตามย่านหรือประเภท
- [x] Tag ของ User: CRUD, กลุ่ม, ลบแล้วถอดจากทุก Place (ตอบจำนวน), แนะนำ tag ของฉันก่อนแล้วตามด้วย tag อื่นในทริป
- [x] Area ของทริป: เปลี่ยนชื่อ / รวม
- [x] Plan Item: place (day, time, Hop) และ transit (เวลา เลขจอง docIds, expenseId); เพิ่มที่เดียวลงหลายวันในครั้งเดียว
- [x] City Legs: แก้ `legs` ของทริป
- [x] Activity ของทุกการแก้ในช่วงนี้

## ช่วง 4 — เงิน

- [x] Expense: CRUD, validate 3 วิธีหาร, editor แก้/ลบเฉพาะของตัวเอง, ช่องทางชำระ (สลิป / เลขท้ายบัตร 4 หลัก)
- [x] `GET /api/trips/:tripId/summary` — สัดส่วนตามหมวด, Net Balance ต่อคน (พร้อมที่มา), Outstanding, Suggested Transfer
- [x] Settlement: สร้างจาก Suggested Transfer, `sent` (ผู้โอน แนบสลิป), `confirmed` (ผู้รับ) — ทุกขั้นเป็น conditional update ที่ filter สถานะปัจจุบัน; test ทั้งมุม Ploy และ Act และการเปลี่ยนสถานะที่ไม่ถูกต้อง (409)
- [x] Activity + `?type=` + รายการที่ต้องทำต่อ ("ตรวจและยืนยัน")
- [x] test end-to-end: seed โตเกียว → summary ได้ตัวเลขตรง → Beam confirmed → Outstanding เปลี่ยนถูก

## ช่วง 5 — เช็คลิสต์ เอกสาร และ login จริง

- [x] Checklist: group / personal (กรองที่ server), คนรับผิดชอบ, ติ๊กแล้วบันทึก `doneBy`, รายการตั้งต้น
- [x] Document: อัปโหลด (PDF/รูป, จำกัดขนาด, ตรวจ mime), signed URL หมดอายุ, ผูกกับ Transit / Expense
- [x] LINE Login และ Google OAuth → สร้าง/หา User (ชื่อ อีเมล รูป) → session cookie; ปิด `mock-user` ใน production
- [x] Rate limit + security headers สำหรับ auth และอัปโหลด

---

## ยังไม่ตัดสินใจ

- `lib/money` ใช้ร่วมกับ frontend หรือไม่: ตอนนี้ทำซ้ำใน `backend/src/domain/money` พร้อม test ตัวเลขเดียวกัน ทางเลือกคือย้ายเป็น workspace `packages/money`
- seed: ตอนนี้เขียนแยกใน backend ให้ผลเท่ากับ `frontend/src/lib/mock` ทางเลือกคือใช้ไฟล์ seed ร่วมกัน
- ที่เก็บเอกสารจริง (S3 / Cloudflare R2 / GCS)
- MongoDB ที่จะใช้จริง (Atlas หรือ self-host) และที่ deploy backend
- ต้องใช้ transaction ตอน Claim (ย้าย Expense/Share ทั้งหมด) หรือไม่ — ขึ้นกับว่าใช้ replica set
- การแจ้งเตือนบนมือถือ (push / LINE Notify) ยังไม่อยู่ในรายการ
- (schema) Claim ไม่ต้องใช้ transaction แล้วตาม `docs/db/schema.md` เพราะทุกอย่างอ้าง `memberId` — ยืนยันเพื่อปิดข้อ transaction ด้านบน
- (schema) Activity เก็บตลอดไป / TTL / archive เมื่อทริปจบ (ตอนนี้: เก็บตลอด + แบ่งหน้า)
- (schema) ชื่อ Tag ซ้ำแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ ("Ramen" = "ramen") หรือไม่ — collation บน index หรือเก็บ `nameKey`
- (schema) ลบเอกสารที่เป็นสลิปของ Expense/Settlement: 409 หรือถอด `slipDocId` ออก
- (schema) แก้ Expense หลังมี Settlement confirmed แล้ว: ยอมให้แก้ / เตือน / ห้าม (SPEC เปิดอยู่)
- (schema) เพดานเงิน ฿20,000,000 ต่อยอด (ให้เป็น int32 เสมอ) พอไหม
- (schema) index Place เปลี่ยนจาก `{ tripId, area }` ใน SPEC เป็น `{ tripId, city, area }` — ต้องแก้ SPEC ให้ตรง
