# ต่อ API เข้ากับ frontend — task list

เปลี่ยน `frontend/src/lib/api` จาก mock store ไปเรียก backend จริง แบ่ง 5 ช่วง **หยุดให้ตรวจทุกครั้งที่จบช่วง**

**เริ่มได้เมื่อ:** ช่วง 4 ของ `first-frontend.md` เสร็จและผ่านการตรวจบน mock แล้ว

อ่านก่อนเริ่ม: `docs/api/API.md` (สัญญา API), `CONTEXT.md` (คำศัพท์), `first-frontend.md` (ข้อตกลงเดิม)

---

## ข้อตกลงที่ตัดสินใจแล้ว (ใช้ทุกช่วง)

### ใครเรียก backend
- **Next server เท่านั้น** (Server Component + Server Action ผ่าน `lib/api`) — browser ไม่เรียก backend เอง
- `lib/api` คง signature เดิม เปลี่ยนแค่ข้างในจาก `getStore()` เป็น `fetch(BACKEND_URL + "/api/...")` → component ไม่ต้องแก้
- ส่ง header `Cookie` ของ request ต่อไปทุกครั้ง, `cache: "no-store"` (ข้อมูลขึ้นกับผู้ใช้)

### โดเมนเดียว
- Next `rewrites`: `/api/:path*` → `BACKEND_URL/api/:path*` — OAuth start/callback, ลิงก์ไฟล์ (signed URL) และ cookie `session` อยู่ใต้โดเมนเว็บ
- backend: `PUBLIC_API_URL` = โดเมนเว็บ (ไม่ใช่ :4000), `CORS_ORIGIN` = โดเมนเว็บ
- frontend env ใหม่: `BACKEND_URL` (ภายใน เช่น `http://backend:4000` ใน docker, `http://localhost:4000` ตอน dev)
- callback ที่ลงทะเบียนกับ LINE / Google = `<โดเมนเว็บ>/api/auth/{provider}/callback`

### Login และผู้ใช้ปัจจุบัน
- `proxy.ts` ผ่านเมื่อมี cookie `session` หรือ (dev เท่านั้น) `mock-user` — เป็นด่านหยาบ ด่านจริงคือ backend
- หน้า Login: production = ลิงก์ `/api/auth/{provider}?next=...`; dev (`NODE_ENV=development`) = ปุ่ม mock ตั้ง `mock-user` แบบเดิม
- ตัวสลับ User (dev): ตั้ง `mock-user` **และลบ `session`** (backend ให้ session ชนะ mock-user) — รายชื่อจาก A17
- logout: `POST /api/auth/logout` + ลบ `mock-user`
- `getCurrentUser` = A1, `requireTripMember` / `getCurrentMember` = A3 — ไม่หา Member เองฝั่ง frontend

### Server Action
- **เก็บ** การตรวจฟอร์ม (`checkExpenseDraft`, `place-form`, `plan-form` ฯลฯ) ไว้ให้ feedback เร็ว — backend ตรวจซ้ำ
- **ลบ** การตรวจสิทธิ์และกติกาเงินใน action — backend ตัดสินฝ่ายเดียว; `lib/permissions` ใช้ซ่อน/แสดงปุ่มเท่านั้น; ลบ `lib/api/balances.ts`
- หลังเขียน: `revalidatePath` เหมือนเดิม

### Error
- `apiFetch` แปลง `{ error: { code, message } }` → `ApiError { status, code, message }`
- 401 → redirect `/login?next=<หน้าปัจจุบัน>`; 404 ของทริป → redirect `/trips`
- action คืน `message` (ไทยจาก backend) ให้ฟอร์มแสดง; ใช้ `code` เฉพาะที่ต้องทำต่าง (แบบ `settlement-errors.ts`)

### ไฟล์ (สลิป / เอกสาร)
- ฟอร์มส่ง `File` ใน FormData → action อัปโหลด B12 (`kind=slip` สำหรับสลิป) → ได้ `docId` → สร้าง/แก้ Expense หรือ Settlement ด้วย `slipDocId`
- ถ้าขั้นที่สองไม่ผ่าน → action ลบไฟล์นั้นด้วย B14 (ไม่ทิ้งไฟล์ค้าง)
- `next.config.ts`: `experimental.serverActions.bodySizeLimit: "11mb"` (ไฟล์ 10 MB + overhead ของ multipart)
- เปิดไฟล์: ขอ signed URL จาก B13 ตอน render

### Mock
- จบงานแล้ว **ไม่มี mock โหมด** — ลบ `lib/mock/store` และ mutations ทั้งหมด backend เป็นแหล่งข้อมูลเดียว
- seed ฝั่ง frontend เหลือเป็น fixture ของ test (`expenses`, `places`, `plan`) และ `/dev/ui` เท่านั้น
- seed backend ใช้ id ชุดเดียวกับ frontend (`act`, `mint`, …) → URL เดิมใช้ได้

### การตรวจทุกช่วง
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` ใน `frontend/`
- รันกับ `docker compose up` + seed ของ backend, เปิดดูที่ 390px
- สลับ owner / editor / viewer แล้วลองสิ่งที่ไม่มีสิทธิ์ → ต้องเห็นข้อความไทยจาก backend ไม่ใช่หน้าพัง
- ไม่เขียน e2e อัตโนมัติ (backend มี `qa-api` แล้ว)

---

## ช่วง 1 — ฐานและ login

- [x] backend `PUBLIC_API_URL` = โดเมนเว็บ (`http://localhost:3000` ใน config.ts, docker-compose, `.env.example` ทั้งสองไฟล์) — **OAuth callback และลิงก์ไฟล์ใช้ไม่ได้จนกว่าจะมี rewrites ข้อถัดไป**
- [x] `BACKEND_URL` ใน env + `docker-compose.yml` (frontend service) + `.env.example`
- [x] `next.config.ts`: rewrites `/api/:path*`, `serverActions.bodySizeLimit`
- [x] `lib/api/http.ts`: `apiFetch` (ส่ง cookie, no-store, `ApiError`, 401 / 404)
- [x] `proxy.ts`: ยอมรับ `session` + `mock-user` (dev)
- [x] Login: ลิงก์ OAuth (production) / ปุ่ม mock (dev); logout เรียก B42
- [x] ตัวสลับ User: A17 + ลบ `session`
- [x] A1 `getCurrentUser`, A2 `listMyTrips` (ใช้ `outstanding` จาก API), A3 `getTrip` / `requireTripMember`

**จบช่วง 1:** login ได้ (mock ใน dev), หน้า Trips แสดงจาก backend, เปิดทริปที่ไม่ใช่สมาชิก → `/trips` → หยุดให้ตรวจ

## ช่วง 2 — อ่านข้อมูลทั้งหมด

- [x] A4–A16 (สมาชิก, เชิญ, เอกสาร, สถานที่, tag, แผน, ค่าใช้จ่าย, settlement, balances, checklist, activity)
- [x] `getChecklist` ไม่ส่ง viewer id แล้ว (server กรองเอง)
- [x] ตรวจตัวเลขโตเกียว: Outstanding Act +฿10,950 · Mint 0 · Beam −฿5,800 · Ploy −฿5,150; viewer เห็นเฉพาะแถวตัวเอง

## ช่วง 3 — เขียน: เงิน

- [x] Expense สร้าง / แก้ / ลบ (B29–B31) + สลิป (B12 → `slipDocId`, ลบไฟล์เมื่อสร้างไม่ผ่าน)
- [x] Settlement แจ้งโอน / เปลี่ยนสลิป / ยืนยัน (B32–…) ตรวจทั้งมุมผู้โอนและผู้รับ
- [x] ลบการตรวจสิทธิ์/กติกาเงินออกจาก `expense-actions`, `settlement-actions`; ลบ `balances.ts`

## ช่วง 4 — เขียน: สถานที่ แผน Tag

- [x] Place, Tag, Area (B15–…), Plan Item / Hop / Transit / City Legs (B…)
- [x] ลบการตรวจสิทธิ์ออกจาก `plan-actions` และ action ของสถานที่

## ช่วง 5 — เขียน: ที่เหลือ แล้วลบ mock

- [x] ทริป, สมาชิก, เชิญ / Claim, เช็คลิสต์, Activity (อ่านแล้ว), เอกสาร
- [x] ลบ `lib/mock/store.ts`, `mutations.ts`, `plan-mutations.ts`, `membership-mutations.ts`; ย้าย seed เป็น fixture ของ test
- [x] `grep -r "lib/mock" frontend/src` เหลือแค่ test และ `/dev/ui`
- [x] แก้ `next.config.ts` คอมเมนต์ที่อ้างถึง mock store

---

## งาน backend (ต้องเสร็จก่อนขึ้น production)

- [x] rate limit ไม่ล็อกทุกคนเมื่อ request มาจาก IP ของ Next server
  - อัปโหลด: นับต่อ **User** (ไม่สน IP / proxy)
  - logout: ไม่จำกัด (ทำซ้ำได้ ไม่มีอะไรให้เดา)
  - OAuth start / callback: นับต่อ IP ตาม `TRUST_PROXY` (จำนวน proxy ข้างหน้าที่เติม IP ลง `X-Forwarded-For`; ค่าเริ่มต้น 0)
  - ไม่ต้องแก้ frontend: Next ไม่เติม IP ให้ (ส่ง `X-Forwarded-For` ที่ client ใส่มาต่อไปตรงๆ) จึงเชื่อไม่ได้อยู่แล้ว และ `apiFetch` ไม่ได้เรียก route ที่นับต่อ IP
  - test: `backend/src/qa/ratelimit.p45.qa.test.ts`
- [ ] ตอน deploy: วาง load balancer ที่เติม IP ลง `X-Forwarded-For` หน้า Next, ตั้ง `TRUST_PROXY=1`, และ **ห้ามเปิด backend (:4000) สู่ภายนอก** (ไม่อย่างนั้นปลอม IP ได้) — ถ้าไม่มี load balancer, OAuth start/callback ของทุกคนจะนับรวมกัน 30 ครั้ง / 15 นาที

## ค้างไว้แก้ทีเดียว (หลังจบช่วง 5)

ดูอีก 2 ข้อท้าย `first-frontend.md` (หน้าแก้/ลบ Place, เปลี่ยนชื่อ tag ซ้ำแล้วรวมเงียบๆ)

- [ ] B9 (JoinTrip) ไม่ส่งคนเชิญ จำนวนสมาชิก/สถานที่/ค่าใช้จ่าย และ `expiresAt` → หน้า JoinTrip ซ่อนแถวตัวเลข ต่างจาก mockup · แนะนำ: เพิ่มใน backend
- [ ] A4 ส่ง Member ที่ `pending` มาด้วย → อาจโผล่ในตัวเลือกคนหาร/คนรับผิดชอบ · แนะนำ: กรองที่ตัวเลือก (หน้า Members ยังต้องเห็นเพื่ออนุมัติ)
- [ ] Activity อ่านแค่ 100 รายการ ยังไม่มีปุ่มโหลดเพิ่ม (A16 รองรับ paging แล้ว)
- [ ] ตารางยอดต่อคน (A14) เรียง Act, Beam, Mint, Ploy ตามลำดับสร้าง — mockup เรียง Act, Mint, Beam, Ploy
- [ ] บั๊ก: viewer เห็นปุ่มเพิ่มค่าใช้จ่ายในแท็บ Expenses
- [ ] บั๊ก: การ์ด Trips "ทุกคนเคลียร์แล้ว" ใช้ A4 จึงไม่นับ Member ที่ถูกนำออกแต่ยังมียอดค้าง
- [ ] (จากช่วง 3) เปลี่ยน/ถอดสลิปแล้วไฟล์เก่ายังค้าง — ให้ action ลบด้วย B14 ไหม
- [ ] (จากช่วง 3) signed URL อายุ 5 นาที สร้างตอน render → เปิดหน้าทิ้งไว้นานแล้วกด "เปิดไฟล์" ได้ 403 · ทางเลือก: route ใน Next ขอลิงก์ใหม่ตอนกด
- [ ] (จากช่วง 3) ปุ่ม "ส่งเตือนอีกครั้ง" ถูกเอาออก (backend ไม่มี endpoint) — ต่างจาก mockup
- [ ] (จากช่วง 3) backend: อัปโหลด/ลบสลิปบันทึก Activity เป็น `plan` → ขึ้นเป็น "แผน" และ upload ที่ rollback ขึ้น 2 แถว
- [ ] (จากช่วง 3) seed backend: `s-beam` อ้าง `slipDocId: 'slip-beam'` ที่ไม่มีอยู่จริง
- [ ] (จากช่วง 3) ยืนยันการโอนซ้ำบนหน้าเก่า: หน้ารีเฟรชแต่ไม่เห็นข้อความ error ของ backend
- [ ] (จากช่วง 3) ปุ่ม "แนบสลิป / เปลี่ยนสลิป" ในการ์ดรอยืนยันของผู้โอน — agent ออกแบบเอง ไม่มีใน mockup
- [ ] (จากช่วง 4) "บันทึกเป็นค่าใช้จ่ายด้วย" จาก Transit: Expense บันทึกแล้วแต่ผูกกับ Transit ไม่ผ่าน (เช่น editor กับ Transit ของคนอื่น) → ขึ้น error ทั้งที่ Expense มีแล้ว กดซ้ำได้รายการซ้ำ
- [ ] (จากช่วง 4) Summary: ยอดค้างของ Beam −฿6,100 แต่แถวโอนแสดง "Beam → Act ฿5,800 รอยืนยัน" (จำนวนจาก Settlement ที่ส่งแล้ว ไม่ใช่ยอดที่ต้องโอนจริง) — ตรวจว่าควรแสดงอย่างไร
- [ ] (จากช่วง 4) ทดสอบที่ 390px ไม่ได้จริง (Chrome กว้างขั้นต่ำ ~500px) — ตรวจ layout มือถือด้วย device emulation อีกรอบ
- [ ] (จากช่วง 5) CreateTrip: hydration mismatch ของวันที่ (server "พฤหัส 26 – อาทิตย์ 29" / browser "พฤ. 26 – อา. 29")
- [ ] (จากช่วง 5) backend บันทึก Activity ของเช็คลิสต์และเอกสารเป็น `plan` (กลุ่มเดียวกับเรื่องสลิป)
- [ ] (จากช่วง 5) สร้างทริปแล้ว frontend เรียก B7 สร้างลิงก์เชิญเอง (B1 ไม่สร้างให้) และเปลี่ยนแค่ "ต้องอนุมัติ" ก็รีเซ็ตวันหมดอายุไปด้วย (B7 ต้องส่งทั้งคู่) · แนะนำ: ให้ backend สร้าง invite ใน B1 และ B7 รับทีละค่า
- [ ] (จากช่วง 5) หน้าเอกสารทริป `/trips/[tripId]/documents` — agent ออกแบบเอง (SPEC ยังเปิดอยู่ ไม่มี mockup); ปุ่มอนุมัติสมาชิกอยู่ในแถวสมาชิก (mockup อยู่ในการ์ดเชิญ)
- [ ] (จากช่วง 5) ยังไม่ได้ทดสอบจริง: เข้าร่วมแบบไม่ต้องอนุมัติ, เข้าร่วมด้วยชื่อใหม่, สลับ "ต้องอนุมัติ" อย่างเดียว, เพิ่มรายการเช็คลิสต์กลุ่มแบบพิมพ์เอง, ส่งลิงก์เชิญตอนสร้างทริป, อัปโหลดล้มตอนสร้างทริป, อ่าน Activity ทีละแถว
- [ ] `frontend/CLAUDE.md` ยังเขียนว่าข้อมูลมาจาก `lib/mock/` และ "ยังไม่มี backend" — ต้องอัปเดต

## ต้องแก้ในเอกสาร

- [x] `docs/api/API.md` B12: ทุก Member อัปโหลด `kind=slip` ได้ (ตรงกับ `document.controller.ts:40` แล้ว)
