# Travel Planner — Frontend

Web app สำหรับเที่ยวเป็นกลุ่ม แบบมือถือเป็นหลัก: list สถานที่ วางแผนรายวัน จดค่าใช้จ่าย หารเงิน และโอนคืน

## แหล่งอ้างอิง (อ่านก่อนเริ่มงาน)

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| `../docs/design/SPEC.md` | ฟีเจอร์ สิทธิ์ การหารเงิน ระบบภาพ โมเดลข้อมูล เรื่องที่ยังเปิดอยู่ (**SPEC ชนะ mockup ถ้าขัดกัน**) |
| `../docs/design/README.md` | วิธีอ่านไฟล์ mockup และตารางชื่อไฟล์ ↔ เลขหน้า |
| `../docs/design/screens/*.dc.html` | **ต้นแบบ UI** 22 หน้า ขนาด 390×844 |

วิธีใช้ mockup:

- เปิดใน browser ไม่ได้ ให้อ่านเป็น source: HTML ใน `<x-dc>` คือโครงหน้าและ inline style (สี ขนาด ระยะห่าง ลำดับ element)
- `{{name}}` = ค่าจากข้อมูล, `<sc-for>` = loop, `<sc-if>` = เงื่อนไข, `href="Xxx.dc.html"` = หน้าถัดไป
- `<script type="text/x-dc">` มีข้อมูลตัวอย่างและ logic เช่น การหารเงินใน `AddExpense.dc.html`, การจัดกลุ่มตามย่านใน `Places.dc.html` ให้ port logic มาเป็น TypeScript ที่มี test ไม่ใช่ copy ตรงๆ
- แปลง inline style เป็น Tailwind class ที่ใช้ token ด้านล่าง ห้ามใส่ hex ตรงๆ ใน component
- ทำ UI ให้ตรง mockup ก่อน ถ้าจะเปลี่ยน layout ให้ถามก่อน

## Stack

- **Next.js 16** (16.4.x) App Router + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (config ผ่าน `@theme` ใน `src/app/globals.css` ไม่มี `tailwind.config.js`)
- Fonts ผ่าน `next/font/google`: Prompt (500/600/700) และ IBM Plex Sans Thai (400/500/600)
- Node 22, package manager: npm

ตั้งโปรเจกต์ครั้งแรก (create-next-app ไม่ยอมสร้างในโฟลเดอร์ที่มีไฟล์อื่น ให้ย้าย CLAUDE.md ออกชั่วคราว แล้วย้ายกลับ):

```bash
npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

## คำสั่ง

```bash
npm run dev        # dev server (Turbopack เป็นค่าเริ่มต้นใน v16)
npm run build      # production build
npm run lint       # ESLint CLI (v16 ไม่มี `next lint` แล้ว)
npx tsc --noEmit   # ตรวจ type
npx next typegen   # สร้าง type PageProps / LayoutProps ของ route
npm test           # Vitest (unit test logic เงิน)
```

ก่อนบอกว่างานเสร็จ ต้องผ่าน `lint`, `tsc --noEmit`, `test` และ `build`

## ข้อกำหนดของ Next.js 16 (ต่างจากเวอร์ชันเก่า)

- `params` และ `searchParams` เป็น **Promise** ต้อง `await` เสมอ ใช้ type `PageProps<'/trips/[tripId]'>` / `LayoutProps<...>` ที่ได้จาก `next typegen`
  ```tsx
  export default async function Page(props: PageProps<'/trips/[tripId]'>) {
    const { tripId } = await props.params
  }
  ```
- `cookies()`, `headers()`, `draftMode()` เป็น async ต้อง `await`
- ใช้ไฟล์ `src/proxy.ts` และ export `proxy` (ไม่ใช่ `middleware.ts`) สำหรับเช็ค session/redirect ไป `/login` — เป็นแค่ด่านแรก สิทธิ์จริงตรวจที่ backend
- config อยู่ที่ `next.config.ts`; `turbopack` อยู่ระดับบนสุด ไม่ใช่ใน `experimental`
- Server Components เป็นค่าเริ่มต้น ใส่ `'use client'` เฉพาะ component ที่มี state/event (ฟอร์ม, sheet, segmented, ตัวกรอง) และให้เล็กที่สุด
- การแก้ข้อมูลใช้ Server Actions (`'use server'`) แล้ว `revalidatePath` / `revalidateTag` หลังแก้
- ถ้าไม่แน่ใจ API ไหน ให้ดู docs ปัจจุบันผ่าน Context7 (`/vercel/next.js/v16.4.5`) ก่อนเขียน อย่าอิงความจำ

## โครงสร้างโฟลเดอร์

```
src/
  app/
    (auth)/login/page.tsx                   19 Login
    join/[token]/page.tsx                   10 JoinTrip
    trips/page.tsx                          9  Trips
    trips/new/page.tsx                      6  CreateTrip
    trips/[tripId]/
      (tabs)/layout.tsx                     แถบเมนูล่าง 5 แท็บ
      (tabs)/page.tsx                       1  Main
      (tabs)/plan/page.tsx                  7  Planner
      (tabs)/places/page.tsx                2 / 14 Places (แท็บเมืองเมื่อมี >1 เมือง)
      (tabs)/expenses/page.tsx              3  Expenses
      (tabs)/summary/page.tsx               5  Summary
      plan/add/page.tsx                     13 PickPlace
      plan/transit/new/page.tsx             18 AddTransit
      places/new/page.tsx                   8 / 15 AddPlace
      places/tags/page.tsx                  17 ManageTags
      route/page.tsx                        16 TripRoute
      expenses/new/page.tsx                 4  AddExpense
      expenses/[expenseId]/page.tsx         11 ExpenseDetail
      summary/settle/page.tsx               12 SettleUp
      members/page.tsx                      20 Members
      activity/page.tsx                     21 Activity
      checklist/page.tsx                    22 Checklist
      documents/page.tsx                    เอกสารของทริป (ไม่มี mockup — SPEC ยังเปิดอยู่)
  components/ui/        ส่วนประกอบที่ใช้ซ้ำ (Button, Card, Chip, Segmented, BottomSheet, Fab, TabBar, Avatar, Money)
  components/<feature>/ component เฉพาะหน้า (trip, places, plan, expenses, settle, checklist)
  lib/money/            คำนวณเงิน (pure function + test)
  lib/api/              เรียก backend (ฝั่ง server เท่านั้น) + types จากโมเดลข้อมูลใน SPEC
  test/fixtures/seed.ts ข้อมูลตัวอย่าง 4 ทริป สำหรับ test และ `/dev/ui` เท่านั้น (ไม่ใช่แหล่งข้อมูลของแอป)
proxy.ts
```

หน้าที่ไม่อยู่ใน `(tabs)` (ฟอร์ม รายละเอียด) เป็นหน้าเต็มจอ มีปุ่มย้อนกลับ ไม่มีเมนูล่าง

## ระบบภาพ (ใส่ใน `@theme` ของ `globals.css`)

| token | ค่า | ใช้กับ |
| --- | --- | --- |
| `--color-bg` | #F3F5F7 | พื้นหน้าจอ |
| `--color-surface` | #FFFFFF | การ์ด |
| `--color-ink` | #13222F | ข้อความหลัก การ์ดทริปสีเข้ม |
| `--color-ink-muted` | #5B6B78 | คำอธิบาย เมนูที่ไม่ได้เลือก |
| `--color-line` | #E3E8EC | เส้นขอบ |
| `--color-primary` | #0B7A6A | ปุ่มหลัก สถานะเลือก ยอดได้คืน (hover #075E52) |
| `--color-primary-soft` | #E3F2EF | พื้นอ่อนของสีหลัก |
| `--color-danger` | #B23A2E | ยอดค้างจ่าย ปุ่มลบ badge |
| `--color-todo` / `--color-todo-soft` | #8A4A0C / #FCEBDD | ยังไม่จัดวัน รอยืนยัน ยอดแบ่งไม่ครบ |
| `--color-type-sight` | #0B7A6A | ประเภท: เที่ยว |
| `--color-type-food` | #B2540F | ประเภท: กิน |
| `--color-type-interest` | #2F5BB7 | ประเภท: น่าสนใจ |
| `--color-type-stay` | #3C4C59 | ประเภท: พัก |
| `--color-type-transit` | #8A3FA0 | ประเภท: เดินทาง / การ์ดเที่ยวบิน |

- **ฟอนต์:** `font-display` = Prompt (หัวข้อและตัวเลข/ยอดเงิน), `font-sans` = IBM Plex Sans Thai (เนื้อความ)
- **ขนาด:** หัวหน้า 24–26px · หัวส่วน 17px · เนื้อความ 15px · คำอธิบาย 12–13px
- **มุมมน:** การ์ด 18–24px (การ์ดทริป 24, การ์ดทั่วไป 20), ปุ่มไอคอน 14px, ปุ่ม/chip 12px หรือ 999px
- **Layout:** ออกแบบที่ 390px กว้าง padding ข้าง 20px ระยะระหว่าง section 16px; จอกว้างกว่าให้จำกัดความกว้างไว้กลางจอ (iPad/คอมยังไม่ได้ออกแบบ). mockup วาดที่ 390px แต่แอปยืดได้ถึง 640px (`max-w-app` = `--container-app` ใน globals.css); element แบบ fixed ต้องใช้ `max-w-app` เหมือนกรอบหลัก
- **ไอคอน:** SVG เส้น stroke 1.8–2.2, `stroke-linecap="round"` ตาม mockup ใส่ `aria-hidden="true"`

## การเข้าถึง (บังคับ)

- ปุ่มและลิงก์สูงอย่างน้อย 44px
- ความต่างสีตัวอักษรอย่างน้อย 4.5:1
- ใช้ `<button>`, `<a>`/`<Link>`, `<input>` จริง ห้ามทำปุ่มจาก `<div>`
- ปุ่มไอคอนต้องมี `aria-label` ภาษาไทย, แท็บที่เลือกอยู่ใส่ `aria-current="page"`
- ไม่ใช้ emoji ใน UI
- `<html lang="th">`

## กติกาเรื่องเงิน

- เก็บและคำนวณเป็น **สตางค์ (integer)** เสมอ ห้ามใช้ float กับเงิน แปลงเป็นบาทตอนแสดงผลเท่านั้น
- ทุก Expense มี `currency: 'THB'` และ `baseAmount` ตั้งแต่แรก (เตรียมหลายสกุลเงิน) แต่ UI ตอนนี้แสดงบาทอย่างเดียว
- แสดงผลแบบ `฿4,800` หรือ `฿1,212.50` (ทศนิยมเฉพาะเมื่อมีสตางค์) ผ่าน component `<Money>` ตัวเดียว
- วิธีหาร (`lib/money/split.ts`):
  - `equal` — หารตามคนที่ติ๊ก เศษสตางค์รวมไว้กับผู้จ่าย
  - `amount` — ระบุยอดแต่ละคน แสดงยอดที่เหลือ/เกิน มีปุ่มเกลี่ยส่วนที่เหลือ
  - `shares` — ปุ่ม − / + นับเป็นส่วน ระบบคำนวณยอด
  - ปุ่มบันทึกกดได้เมื่อผลรวมเท่ายอดเต็มพอดีเท่านั้น
- ยอดสุทธิต่อคน = จ่ายไป − ส่วนที่ต้องจ่าย คำนวณจาก Expense ทุกครั้ง ไม่เก็บซ้ำ
- การโอนคืนคิดจากยอดสุทธิทั้งทริป และลดจำนวนครั้งที่โอนให้น้อยที่สุด (`lib/money/settle.ts`)
- Settlement มี 3 สถานะ: `pending` (รอโอน) → `sent` (รอยืนยัน, ผู้โอนแนบสลิป) → `confirmed` (ผู้รับยืนยัน)
- **ต้องมี unit test** ที่ใช้ตัวเลขทริปตัวอย่าง: รวม ฿30,350; Act +฿14,050, Mint −฿3,100, Beam −฿5,800, Ploy −฿5,150

## สิทธิ์

`owner` (ผู้จัดทริป) / `editor` (แก้ไขได้) / `viewer` (ดูอย่างเดียว) — รายละเอียดใน SPEC

- frontend ซ่อนหรือ disable ปุ่มตามสิทธิ์ได้ แต่ถือเป็นแค่ UX **backend ต้องตรวจสิทธิ์ทุก endpoint**
- editor แก้/ลบได้เฉพาะค่าใช้จ่ายที่ตัวเองสร้าง
- เช็คลิสต์ `personal` แสดงเฉพาะของเจ้าของ (กรองที่ backend)
- การลบทุกอย่างต้องมีหน้าต่างยืนยันก่อน

## ข้อจำกัดที่ตัดสินใจแล้ว (อย่าเพิ่มเอง)

- ลิงก์ Google Maps เก็บไว้เปิดอย่างเดียว ไม่ดึงข้อมูล ไม่เรียก Maps API ไม่ฝังแผนที่
- เข้าสู่ระบบด้วย LINE หรือ Google เท่านั้น ใช้แค่ชื่อ อีเมล รูปโปรไฟล์ ปุ่มต้องทำตาม brand guideline ของแต่ละเจ้า (ปุ่มใน mockup เป็นแบบกลาง)
- สถานที่เป็นคลังกลางของทริป แยกจาก PlanItem ที่เดียวลงแผนได้หลายวัน
- สถานที่จัดเป็น เมือง › ย่าน + tag หลายอัน; แท็บเมืองแสดงเมื่อทริปมี >1 เมือง
- เอกสารของทริปเก็บแบบ private เปิดด้วย signed URL
- ยังไม่ทำ: สกุลเงินต่างประเทศ, offline/sync, หน้าจอ iPad/คอม, QR พร้อมเพย์จริง (EMVCo), หน้ารายละเอียดสถานที่ — ดู "เรื่องที่ยังเปิดอยู่" ใน SPEC
- ชื่อแอปคือ `Plan Trip`

## Backend

Backend อยู่ที่ `../backend` (Express + MongoDB) สัญญา API อยู่ใน `../docs/api/API.md` ข้อตกลงการต่อ API อยู่ใน `../connect-api.md` และเหตุผลใน `../docs/adr/0001-next-server-calls-backend-same-domain.md`

- **Next server เท่านั้นที่เรียก backend** ผ่าน `lib/api/http.ts` (`apiFetch`) ซึ่งส่ง cookie ของ request ต่อไปและใช้ `no-store` — browser ไม่เรียก backend ตรง ห้ามสร้าง fetch layer ที่สอง
- `next.config.ts` rewrite `/api/*` → `BACKEND_URL` ให้ OAuth, ลิงก์ไฟล์ (signed URL) และ cookie `session` อยู่โดเมนเดียวกับเว็บ
- component อ่านข้อมูลผ่าน `lib/api` เท่านั้น; การแก้ข้อมูลเป็น Server Action ใน `lib/api/*-actions.ts`
- Server Action ตรวจฟอร์มด้วยฟังก์ชันล้วน (`lib/*-form.ts`, `checkExpenseDraft`) ได้ แต่**ไม่ตรวจสิทธิ์หรือกติกาเงินเอง** — backend ตัดสินฝ่ายเดียว แล้วแสดง `message` ภาษาไทยที่ backend ส่งมา; `lib/permissions` ใช้ซ่อน/แสดงปุ่มเท่านั้น
- ยอดเงิน (Net Balance, Outstanding, Suggested Transfer) มาจาก backend; `lib/money` ใช้ในฟอร์ม (หารเงิน, แสดงผล) และ test
- ไฟล์: action อัปโหลดด้วย B12 ก่อน แล้วค่อยบันทึกรายการด้วย `docId`; ถ้าบันทึกไม่ผ่านให้ลบไฟล์ทิ้งด้วย B14
- ผู้ใช้: cookie `session` (OAuth) — ตอน dev ใช้ cookie `mock-user` = User id (`act`, `mint`, `beam`, `ploy`, `n`) ได้ด้วย

รัน local: `docker compose up --build` ที่ root แล้ว seed ด้วย `docker compose exec backend node dist/seed/run.js` ส่วน frontend รัน `npm run dev` (ตั้ง `BACKEND_URL`, ค่าเริ่มต้น `http://localhost:4000`)

## สไตล์โค้ด

- ข้อความ UI เป็นภาษาไทยตาม mockup; ชื่อตัวแปร/ไฟล์/คอมเมนต์เป็นภาษาอังกฤษ
- component เป็น function + named export ยกเว้น `page.tsx` / `layout.tsx` ที่ต้อง default export
- ใช้ `next/link` สำหรับลิงก์ภายใน, `next/image` สำหรับรูป
- วันที่แสดงแบบไทย พ.ศ. เช่น "ส. 12 – อ. 15 ธ.ค. 2569" ผ่าน `Intl.DateTimeFormat('th-TH')`
