# First frontend — task list

Implement Next.js frontend ตาม design ใน `docs/design/` แบ่ง 5 ช่วง **หยุดให้ตรวจทุกครั้งที่จบช่วง**

อ่านก่อนเริ่ม: `frontend/CLAUDE.md` (กติกาหลัก), `docs/design/SPEC.md`, `CONTEXT.md` (คำศัพท์) — ลำดับเมื่อขัดกัน: SPEC > mockup > frontend/CLAUDE.md

ทุกช่วงต้องผ่าน `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` ใน `frontend/` และเปิดดูที่ 390px เทียบ mockup ก่อนบอกว่าเสร็จ

---

## ข้อตกลงที่ตัดสินใจแล้ว (ใช้ทุกช่วง)

### ผู้ใช้ปัจจุบัน
- cookie `mock-user` เก็บ **User id** (ค่าเริ่มต้น `act`) — ไม่ใช่ Member id เพราะ Member ผูกกับทริปเดียว
- `lib/api` มี `getCurrentUser()` และ `getCurrentMember(tripId)` (หา Member จาก User + ทริป) ทุกหน้าคำนวณ "คุณ" จากค่านี้ ห้าม hard-code ชื่อ
- ตัวสลับ User เล็กๆ แสดงเฉพาะ `NODE_ENV === 'development'` (Act / Mint / Beam / Ploy / N)
- เปิดทริปที่ไม่ได้เป็นสมาชิก → redirect ไป `/trips`
- ใน mock ถือว่าสมาชิกทริปโตเกียวผูกบัญชีครบแล้ว หน้า JoinTrip ใช้ข้อมูลตัวอย่างของหน้าเอง (ยืนยันอีกครั้ง: ไม่ใช้ข้อมูลจริงจาก store)

### สิทธิ์แก้ไข (ตกลงแล้ว)
- editor แก้/ลบได้เฉพาะ Place / Plan Item (รวม Hop) / Expense ที่ตัวเองสร้าง (`createdBy`) — Plan Item มี `createdBy`
- เปลี่ยนชื่อ/รวม Area และแก้ City Legs (หน้า TripRoute): owner เท่านั้น

### ข้อมูล mock
- store ในหน่วยความจำบน `globalThis` (รอด hot reload) seed ตอนเริ่ม รีเซ็ตเมื่อรีสตาร์ต server
- Server Actions แก้ store แล้ว `revalidatePath` — ข้อมูลเชื่อมกันข้ามหน้า
- component เรียกข้อมูลผ่าน `lib/api` เท่านั้น
- การแก้ข้อมูลเพิ่ม Activity ลง store ด้วย (เพื่อให้หน้า 21 มีของจริง)

### เงิน (ดูนิยามใน `CONTEXT.md`)
- **Net Balance** = จ่ายไป − ผลรวม Share คิดจาก Expense อย่างเดียว
- **Outstanding** = Net Balance หลังหัก Settlement ที่ `confirmed` (ที่ `sent` ยังไม่หัก แต่แสดง "รอยืนยัน")
- Suggested Transfer คิดจาก Outstanding ให้โอนน้อยครั้งที่สุด
- ใช้ที่ไหน: ตารางยอดต่อคนใน Summary = Net Balance; การ์ด Trips, การ์ด "จะได้คืน" ใน Expenses, SettleUp, "ใครต้องโอนให้ใคร" = Outstanding
- ผลที่ต่างจาก mockup: การ์ดของ Act แสดง **+฿10,950** (ไม่ใช่ +฿14,050) เพราะ Mint โอน ฿3,100 และยืนยันแล้ว
- เศษสตางค์ (equal / shares): รวมไว้กับผู้จ่าย ถ้าผู้จ่ายไม่ร่วมหาร ให้คนแรกที่ติ๊ก (ตาม mockup)

### Seed 4 ทริป
1. **โตเกียวหน้าหนาว** — ครบทุกหน้า: 4 สมาชิก, 12 สถานที่ 5 ย่าน (ยังไม่จัดวัน 3), แผน 4 วัน, Transit เที่ยวบิน, 5 Expense จาก `Summary.dc.html`, Settlement (Mint confirmed ฿3,100 · Beam sent ฿5,800 · Ploy ยังไม่มี), เช็คลิสต์, Activity
2. **ญี่ปุ่นฤดูใบไม้ผลิ** — Tokyo · Kyoto · Osaka, สมาชิก Act + N, City Legs, สถานที่และ tag จาก PlacesJP / AddPlaceJP / TripRoute, ยังไม่มีค่าใช้จ่าย
3. **เขาใหญ่สุดสัปดาห์** (ผ่านมาแล้ว) — 3 คน ค่าใช้จ่ายสังเคราะห์ 2–3 รายการ รวม ฿7,860 ให้ Act ค้าง −฿320
4. **เกาะล้าน** (ผ่านมาแล้ว) — 3 คน รวม ฿4,200 Settlement confirmed ครบ → ฿0

### Tag
- Tag เป็นของ **User** ใช้ซ้ำได้ทุกทริป มีกลุ่มของตัวเอง
- tag บน Place ทุกคนในทริปเห็น ตัวกรองหน้าสถานที่ = ทุก tag ที่ใช้กับ Place ในทริปนั้น
- หน้าจัดการ tag แสดงเฉพาะ tag ของ Current User; ลบ tag = ถอดออกจากทุก Place หน้าต่างยืนยันบอกจำนวนที่
- ช่อง tag ในฟอร์มแนะนำ tag ของฉันก่อน แล้วตามด้วย tag อื่นในทริป เลือกของคนอื่นใช้ tag เดิม ไม่สร้างซ้ำ

### State หน้าจอ
- มุมมอง/ตัวกรองอยู่ใน **searchParams** เช่น `plan?day=2`, `places?group=type&tags=a,b&unscheduled=1&city=kyoto`, `trips?tab=past`, `activity?type=expense`
- state ชั่วคราว (sheet ที่เปิด, แถวที่กาง, ค่าในฟอร์ม) ใช้ `useState`

### วันที่
- นับถอยหลังและ "กำลังจะไป / ผ่านมาแล้ว" คิดจากวันที่จริง (mockup เขียน "อีก 34 วัน" แต่จะแสดงตามจริง)

---

## ช่วง 1 — ฐาน

- [x] `git init` ที่ root + `.gitignore`
- [x] สร้างโปรเจกต์ด้วย `create-next-app` ตาม `frontend/CLAUDE.md` (ย้าย CLAUDE.md ออกชั่วคราวแล้วย้ายกลับ) ตรวจว่าได้ Next 16.4.x / React 19 / Tailwind v4
- [x] `globals.css`: token สีทั้งหมดใน `@theme`, `font-display` / `font-sans`, พื้นหลัง `bg-bg`
- [x] `layout.tsx`: `<html lang="th">`, ฟอนต์ Prompt + IBM Plex Sans Thai ผ่าน `next/font/google`, กรอบกว้างสูงสุด 390px กลางจอ
- [x] ตั้ง Vitest + สคริปต์ `npm test`
- [x] `lib/money/format.ts` — สตางค์ → `฿4,800` / `฿1,212.50` + test
- [x] `lib/money/split.ts` — `equal` / `amount` / `shares` + เกลี่ยส่วนที่เหลือ + ตรวจว่าครบพอดี + test (รวมกรณีเศษ, ผู้จ่ายไม่ร่วมหาร)
- [x] `lib/money/balance.ts` — Net Balance และ Outstanding + test
  - Net: รวม ฿30,350; Act +14,050 · Mint −3,100 · Beam −5,800 · Ploy −5,150
  - Outstanding: Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150
- [x] `lib/money/settle.ts` — Suggested Transfer โอนน้อยครั้งที่สุด + test (ผลรวมเป็น 0, จำนวนครั้ง ≤ n−1)
- [x] `lib/date.ts` — รูปแบบไทย พ.ศ. "ส. 12 – อ. 15 ธ.ค. 2569" + นับวัน + test
- [x] `lib/api/types.ts` — type จากโมเดลข้อมูลใน SPEC (+ User)
- [x] `lib/mock/` — store บน `globalThis` + seed 4 ทริป
- [x] `lib/api/` — ฟังก์ชันอ่านข้อมูล + `getCurrentUser` / `getCurrentMember` จาก cookie `mock-user`
- [x] `components/ui/`: Button, Card, Chip, Segmented, BottomSheet, Fab, TabBar, Avatar, Money, IconButton, BackHeader, ConfirmDialog
- [x] ตัวสลับ User ตอน dev
- [x] หน้า `/dev/ui` ชั่วคราวแสดง component ทั้งหมดไว้ตรวจ (ลบหรือซ่อนใน production)

**จบช่วง 1:** test เงินผ่านด้วยตัวเลขทริปตัวอย่าง, component ครบ, เช็คครบ 4 คำสั่ง → หยุดให้ตรวจ

## ช่วง 2 — หน้าหลักและ 5 แท็บ (อ่านอย่างเดียว)

- [x] `trips/[tripId]/(tabs)/layout.tsx` + TabBar 5 แท็บ (`aria-current="page"`)
- [x] 1 Main — นับถอยหลัง สมาชิก การเดินทาง งบที่ใช้ไป การ์ดเช็คลิสต์ แผนรายวัน กระดิ่ง
- [x] 7 Planner — timeline ต่อวัน `?day=`, หัววันบอกย่าน, Hop ระหว่างรายการ, การ์ด Transit สีม่วง, กล่อง "ยังไม่จัดวัน"
- [x] 2 / 14 Places — จัดกลุ่มตามย่าน/ประเภท, ตัวกรอง tag หลายอัน + "ยังไม่จัดวัน", แท็บเมืองเมื่อ >1 เมือง (ตรวจกับทริปญี่ปุ่น)
- [x] 3 Expenses — จัดกลุ่มตามวัน, การ์ดยอดรวม + Outstanding ของฉัน
- [x] 5 Summary — สัดส่วนตามหมวด, Net Balance ต่อคน (กางดูที่มาได้), ใครต้องโอนให้ใคร
- [x] สลับ User แล้วตัวเลข "คุณ" ทุกหน้าเปลี่ยนถูก

**จบช่วง 2:** หยุดให้ตรวจรูปแบบ component ก่อนทำหน้าที่เหลือ

## ช่วง 3 — ฟอร์มเงิน

- [x] 4 AddExpense — 3 วิธีหาร, แถบสถานะเหลือ/เกิน, ปุ่มเกลี่ย, ปุ่มบันทึกกดได้เมื่อครบพอดี, ช่องทางชำระ (สลิป / เลขท้ายบัตร) → Server Action
- [x] 11 ExpenseDetail — แก้ / ลบ (ยืนยันก่อนลบ), editor แก้ได้เฉพาะของตัวเอง
- [x] 12 SettleUp — pending → sent (แนบสลิป) → confirmed (ผู้รับยืนยัน), ตรวจทั้งมุม Ploy (ผู้โอน) และ Act (ผู้รับ); QR เป็นภาพตัวอย่าง ไม่ใช่ EMVCo
- [x] หลังบันทึก: Expenses, Summary, การ์ด Trips และ Activity อัปเดตตาม

## ช่วง 4 — ฟอร์มแผนและสถานที่

- [x] 8 / 15 AddPlace — ชื่อ, ลิงก์ Maps (เปิดอย่างเดียว), ประเภท, เมือง, ย่าน, tag, โน้ต
- [x] 17 ManageTags — tag ของฉัน, ย้ายกลุ่ม, เปลี่ยนชื่อ, ลบ (บอกจำนวนที่), จัดการย่าน
- [x] 13 PickPlace — รับ `?day=`, ย่านเดียวกับวันนั้นขึ้นก่อน, เลือกเวลา, ติ๊กหลายวัน
- [x] 18 AddTransit — Hop (วิธีเดินทาง นาที โน้ต) และ Transit (ต้นทาง→ปลายทาง เวลา เลขจอง เอกสาร ผูก Expense)
- [x] 16 TripRoute — City Legs ของทริปหลายเมือง

## ช่วง 5 — ก่อนเข้าทริปและส่วนเสริม

- [x] 19 Login — ปุ่ม LINE / Google แบบ mock ตั้ง cookie `mock-user` แล้วกลับ `next` (ตอนทำจริงต้องใช้ปุ่มตาม brand guideline)
- [x] `src/proxy.ts` — ไม่มี cookie → `/login?next=...`
- [x] 9 Trips — `?tab=upcoming|past`, การ์ดแสดง Outstanding ของฉัน
- [x] 6 CreateTrip — ฟอร์มทริป สมาชิก เอกสาร (ชื่อสำเร็จรูป)
- [x] 10 JoinTrip — เลือก Unclaimed Member หรือเพิ่มตัวเอง (Claim)
- [x] 20 Members — สิทธิ์, นำออก, ลิงก์เชิญ (หมดอายุ / อนุมัติ / รีเซ็ต)
- [x] 21 Activity — วันนี้/เมื่อวาน, `?type=`, ปุ่ม "ตรวจและยืนยัน"
- [x] 22 Checklist — กลุ่ม / ส่วนตัว (personal เห็นเฉพาะเจ้าของ), คนรับผิดชอบ, รายการแนะนำ

---

## ยังไม่ตัดสินใจ

- เขียน ADR เรื่อง Tag เป็นของ User (`docs/adr/0001-tags-owned-by-user.md`) หรือไม่
- ย้ายข้อตกลงด้านบนเข้า `frontend/CLAUDE.md` หรือใช้ไฟล์นี้อ้างอิงไปก่อน
- (จากตรวจช่วง 4) ยังไม่มีหน้าแก้ / ลบ Place — กติกา "editor แก้ได้เฉพาะของตัวเอง" ตอนนี้ใช้กับ Hop อย่างเดียว · ค้างไว้แก้ทีเดียวหลังต่อ API
- (จากตรวจช่วง 4) เปลี่ยนชื่อ tag ให้ซ้ำกับ tag ที่มีอยู่ → ตอนนี้รวมสอง tag เงียบๆ: ยอมรับ / ยืนยันก่อน / ห้าม · ค้างไว้แก้ทีเดียวหลังต่อ API
