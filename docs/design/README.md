# Travel Planner — design handoff

แพ็กนี้เป็น design ของแอปวางแผนเที่ยวเป็นกลุ่ม (mobile-first) สำหรับใช้เป็นต้นแบบตอนเขียนโค้ดจริง

## ไฟล์ในแพ็ก

| ไฟล์ | คืออะไร |
| --- | --- |
| `SPEC.md` | สรุปการออกแบบ: ฟีเจอร์ หน้าจอ สิทธิ์ การหารเงิน ระบบภาพ โมเดลข้อมูลที่แนะนำ และเรื่องที่ยังเปิดอยู่ |
| `screens/*.dc.html` | mockup ทีละหน้าจอ (หน้า 1–22 มือถือ 390×844, หน้า 23–27 Admin บนคอม 1440×900) เลขหน้าตรงกับใน SPEC |
| `screens/canvas.json` | ชื่อหน้าจอและลำดับบน canvas |

## วิธีอ่านไฟล์ `.dc.html`

- เป็นรูปแบบ mockup ของเครื่องมือออกแบบ ไม่ใช่โค้ดที่ใช้ production ได้ตรงๆ เปิดใน browser ตรงๆ จะไม่ render เพราะต้องใช้ runtime ของเครื่องมือนั้น
- ส่วน HTML ใน `<x-dc>` คือโครงหน้าจอและสไตล์ (inline style) ใช้เป็นแหล่งอ้างอิงสี ขนาด ระยะห่าง และลำดับ element
- `{{name}}` คือค่าที่ผูกกับข้อมูล `<sc-for>` คือ loop `<sc-if>` คือเงื่อนไข
- `<script type="text/x-dc">` ด้านล่างมีข้อมูลตัวอย่างและ logic ของหน้าจอ เช่น การคำนวณหารเงินใน `AddExpense.dc.html` และการจัดกลุ่มตามย่านใน `Places.dc.html`
- ลิงก์ `href="Xxx.dc.html"` บอกว่าแต่ละหน้าไปหน้าไหนต่อ

## ชื่อไฟล์ ↔ เลขหน้า

| เลข | ไฟล์ | | เลข | ไฟล์ |
| --- | --- | --- | --- | --- |
| 1 | Main | | 12 | SettleUp |
| 2 | Places | | 13 | PickPlace |
| 3 | Expenses | | 14 | PlacesJP |
| 4 | AddExpense | | 15 | AddPlaceJP |
| 5 | Summary | | 16 | TripRoute |
| 6 | CreateTrip | | 17 | ManageTags |
| 7 | Planner | | 18 | AddTransit |
| 8 | AddPlace | | 19 | Login |
| 9 | Trips | | 20 | Members |
| 10 | JoinTrip | | 21 | Activity |
| 11 | ExpenseDetail | | 22 | Checklist |

| เลข | ไฟล์ (Admin, คอม 1440×900) |
| --- | --- |
| 23 | AdminOverview |
| 24 | AdminUsers |
| 25 | AdminUserDetail |
| 26 | AdminTrips |
| 27 | AdminSystem |

หน้า 14–16 เป็นตัวอย่างหน้าเดียวกันเมื่อทริปมีหลายเมือง (15 ซ้ำกับหน้า 8)
