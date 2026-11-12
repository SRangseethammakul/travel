/**
 * Test fixture: the sample trips from the mockups (the backend seed uses the
 * same ids). Used by unit tests and /dev/ui only — the app reads the backend.
 * Pure: `createSeed(now)` always returns fresh objects. Sources:
 * - โตเกียวหน้าหนาว: Summary / Expenses / Places / Planner / Checklist / Activity / Main mockups
 * - ญี่ปุ่นฤดูใบไม้ผลิ: PlacesJP / AddPlaceJP / TripRoute mockups
 * - เขาใหญ่ / เกาะล้าน: synthetic, to match the Trips mockup totals
 */
import { computeSplit } from "@/lib/money/split";
import type {
  Activity,
  ChecklistItem,
  ColorKey,
  Expense,
  ExpenseCategory,
  Hop,
  Invite,
  Member,
  PaymentMethod,
  Place,
  PlaceType,
  PlanItem,
  Settlement,
  Tag,
  Trip,
  TripDocument,
  User,
} from "@/lib/api/types";

export interface SeedData {
  users: User[];
  trips: Trip[];
  members: Member[];
  invites: Invite[];
  documents: TripDocument[];
  places: Place[];
  tags: Tag[];
  planItems: PlanItem[];
  expenses: Expense[];
  settlements: Settlement[];
  checklist: ChecklistItem[];
  activity: Activity[];
  /** Counter for new ids created by Server Actions. */
  seq: number;
}

export const TRIP_IDS = {
  tokyo: "tokyo-winter",
  japan: "japan-spring",
  khaoYai: "khao-yai",
  kohLarn: "koh-larn",
} as const;

// ── Users ───────────────────────────────────────────────────────────────────

const users: User[] = [
  { id: "act", name: "Act", email: "act@example.com", provider: "google", color: "teal" },
  { id: "mint", name: "Mint", email: "mint@example.com", provider: "line", color: "blue" },
  { id: "beam", name: "Beam", email: "beam@example.com", provider: "line", color: "orange" },
  { id: "ploy", name: "Ploy", email: "ploy@example.com", provider: "line", color: "purple" },
  { id: "n", name: "N", email: "n@example.com", provider: "google", color: "slate" },
];

const userById = Object.fromEntries(users.map((u) => [u.id, u]));

function member(tripId: string, userId: string, role: Member["role"]): Member {
  const u = userById[userId];
  return {
    id: `${tripId}:${userId}`,
    tripId,
    userId,
    displayName: u.name,
    role,
    joinedVia: u.provider,
    color: u.color,
  };
}

/** Member id helper: m("tokyo-winter", "act") → "tokyo-winter:act". */
export const memberId = (tripId: string, key: string) => `${tripId}:${key}`;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ExpenseSeed {
  id: string;
  title: string;
  category: ExpenseCategory;
  payer: string;
  method: PaymentMethod;
  cardLast4?: string;
  amountBaht: number;
  with: string[];
  date: string;
  note?: string;
  createdAt: string;
}

function equalExpense(tripId: string, e: ExpenseSeed): Expense {
  const amount = e.amountBaht * 100;
  const payerId = memberId(tripId, e.payer);
  const split = computeSplit({
    mode: "equal",
    total: amount,
    payerId,
    participantIds: e.with.map((k) => memberId(tripId, k)),
  });
  return {
    id: e.id,
    tripId,
    title: e.title,
    category: e.category,
    payerId,
    method: e.method,
    ...(e.cardLast4 ? { cardLast4: e.cardLast4 } : {}),
    amount,
    currency: "THB",
    baseAmount: amount,
    splitMode: "equal",
    shares: split.shares,
    ...(e.note ? { note: e.note } : {}),
    date: e.date,
    createdBy: payerId,
    createdAt: e.createdAt,
  };
}

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

// ── Seed ────────────────────────────────────────────────────────────────────

export function createSeed(now: Date = new Date()): SeedData {
  const T = TRIP_IDS.tokyo;
  const J = TRIP_IDS.japan;
  const K = TRIP_IDS.khaoYai;
  const L = TRIP_IDS.kohLarn;

  const trips: Trip[] = [
    {
      id: T,
      name: "โตเกียวหน้าหนาว",
      destination: "โตเกียว · ญี่ปุ่น",
      startDate: "2026-12-12",
      endDate: "2026-12-15",
      budget: 3_600_000,
      baseCurrency: "THB",
      cover: "ink",
      meetingPoint: "สุวรรณภูมิ · ศ. 11 ธ.ค. 21:30",
      createdBy: "act",
    },
    {
      id: J,
      name: "ญี่ปุ่นฤดูใบไม้ผลิ",
      destination: "Tokyo · Kyoto · Osaka",
      startDate: "2027-03-20",
      endDate: "2027-03-28",
      budget: null,
      baseCurrency: "THB",
      cover: "blue",
      legs: [
        { city: "Tokyo", from: 1, to: 4 },
        { city: "Kyoto", from: 5, to: 6 },
        { city: "Osaka", from: 7, to: 9 },
      ],
      createdBy: "act",
    },
    {
      id: K,
      name: "เขาใหญ่สุดสัปดาห์",
      destination: "นครราชสีมา · ไทย",
      startDate: "2026-06-13",
      endDate: "2026-06-14",
      budget: null,
      baseCurrency: "THB",
      cover: "orange",
      createdBy: "mint",
    },
    {
      id: L,
      name: "เกาะล้าน",
      destination: "ชลบุรี · ไทย",
      startDate: "2026-08-08",
      endDate: "2026-08-09",
      budget: null,
      baseCurrency: "THB",
      cover: "purple",
      createdBy: "act",
    },
  ];

  const kongId = memberId(K, "kong");
  const members: Member[] = [
    member(T, "act", "owner"),
    member(T, "mint", "editor"),
    member(T, "beam", "editor"),
    member(T, "ploy", "editor"),
    member(J, "act", "owner"),
    member(J, "n", "editor"),
    member(K, "mint", "owner"),
    member(K, "act", "editor"),
    // Unclaimed Member: added by Mint, nobody has claimed "Kong" yet.
    { id: kongId, tripId: K, userId: null, displayName: "Kong", role: "editor", color: "gray" },
    member(L, "act", "owner"),
    member(L, "beam", "editor"),
    member(L, "ploy", "editor"),
  ];

  const invites: Invite[] = [
    {
      tripId: T,
      token: "tokyo-winter-7d",
      expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      requireApproval: true,
    },
  ];

  const documents: TripDocument[] = [
    { id: "doc-flight", tripId: T, name: "ตั๋วเครื่องบิน ไป-กลับ", fileKey: "mock/tokyo/flight.pdf", mime: "application/pdf", size: 245_760, uploadedBy: memberId(T, "act") },
    { id: "doc-hotel", tripId: T, name: "ใบจองโรงแรม ชินจูกุ", fileKey: "mock/tokyo/hotel.pdf", mime: "application/pdf", size: 319_488, uploadedBy: memberId(T, "act") },
    { id: "doc-insurance", tripId: T, name: "ประกันเดินทาง", fileKey: "mock/tokyo/insurance.pdf", mime: "application/pdf", size: 180_224, uploadedBy: memberId(T, "mint") },
  ];

  // ── Tags (owned by Users, reused across trips) ──
  const tag = (id: string, ownerId: string, name: string, group: string | null, color?: ColorKey): Tag => ({
    id,
    ownerId,
    name,
    group,
    ...(color ? { color } : {}),
  });
  const tags: Tag[] = [
    tag("tag-ramen", "act", "ราเมง", "อาหาร", "orange"),
    tag("tag-yakiniku", "act", "ปิ้งย่าง", "อาหาร", "orange"),
    tag("tag-shabu", "act", "ชาบู", "อาหาร", "orange"),
    tag("tag-cafe", "act", "คาเฟ่", "อาหาร", "orange"),
    tag("tag-tempura", "act", "เทมปุระ", "อาหาร", "orange"),
    tag("tag-booking", "act", "ต้องจอง", null),
    tag("tag-late", "act", "เปิดดึก", null),
    tag("tag-souvenir", "act", "ของฝาก", null),
    tag("tag-temple", "act", "ไหว้พระ", null),
    tag("tag-view", "act", "วิว", null),
    // N's own tags, used on the Japan trip
    tag("tag-soba", "n", "โซบะ", null),
    tag("tag-street", "n", "สตรีทฟู้ด", null),
  ];

  // ── Places ──
  const place = (
    tripId: string,
    id: string,
    name: string,
    type: PlaceType,
    city: string,
    area: string | null,
    tagIds: string[] = [],
    by = "act",
    note = "",
  ): Place => ({ id, tripId, name, type, city, area, tagIds, note, createdBy: memberId(tripId, by) });

  const places: Place[] = [
    // Tokyo — 12 places, 5 areas, 3 unscheduled (Places.dc.html)
    place(T, "t-hotel", "โรงแรมใกล้สถานีชินจูกุ", "stay", "Tokyo", "Shinjuku", [], "act", "เช็คอิน 15:00"),
    place(T, "t-ramen", "ร้านราเมงซุปเข้มข้น", "food", "Tokyo", "Shinjuku", ["tag-ramen", "tag-late"], "mint"),
    place(T, "t-yakiniku", "ยากินิคุหลังสถานี", "food", "Tokyo", "Shinjuku", ["tag-yakiniku", "tag-booking"]),
    place(T, "t-omoide", "Omoide Yokocho", "interest", "Tokyo", "Shinjuku", [], "beam"),
    place(T, "t-sensoji", "วัดเซ็นโซจิ", "sight", "Tokyo", "Asakusa", ["tag-temple"], "ploy"),
    place(T, "t-skytree", "Tokyo Skytree", "sight", "Tokyo", "Asakusa", ["tag-view"], "ploy"),
    place(T, "t-tempura", "ร้านเทมปุระเก่าแก่", "food", "Tokyo", "Asakusa", ["tag-tempura", "tag-booking"]),
    place(T, "t-shabu", "ชาบูบุฟเฟ่ต์", "food", "Tokyo", "Akihabara", ["tag-shabu"], "mint"),
    place(T, "t-cafe", "คาเฟ่ใต้ทางรถไฟ", "food", "Tokyo", "Akihabara", ["tag-cafe"], "mint"),
    place(T, "t-shibuya", "Shibuya Crossing", "interest", "Tokyo", "Shibuya", [], "beam"),
    place(T, "t-omiyage", "โซนขนมของฝากในสถานี", "interest", "Tokyo", "Tokyo Station", ["tag-souvenir"]),
    place(T, "t-haneda", "สนามบินฮาเนดะ", "transit", "Tokyo", null),
    // Japan — 16 places in 3 cities (PlacesJP.dc.html)
    place(J, "j-hotel", "โรงแรมใกล้สถานีชินจูกุ", "stay", "Tokyo", "Shinjuku"),
    place(J, "j-ramen", "ร้านราเมงซุปเข้มข้น", "food", "Tokyo", "Shinjuku", ["tag-ramen", "tag-late"]),
    place(J, "j-yakiniku", "ยากินิคุหลังสถานี", "food", "Tokyo", "Shinjuku", ["tag-yakiniku", "tag-booking"]),
    place(J, "j-omoide", "Omoide Yokocho", "interest", "Tokyo", "Shinjuku"),
    place(J, "j-cafe", "คาเฟ่ใต้ทางรถไฟ", "food", "Tokyo", "Akihabara", ["tag-cafe"]),
    place(J, "j-shabu", "ชาบูบุฟเฟ่ต์", "food", "Tokyo", "Akihabara", ["tag-shabu"]),
    place(J, "j-station-ramen", "ราเมงสตรีทในสถานี", "food", "Tokyo", "Tokyo Station", ["tag-ramen"]),
    place(J, "j-omiyage", "โซนขนมของฝากในสถานี", "interest", "Tokyo", "Tokyo Station", ["tag-souvenir"]),
    place(J, "j-sensoji", "วัดเซ็นโซจิ", "sight", "Tokyo", "Asakusa"),
    place(J, "j-matcha", "ร้านมัทฉะในซอยเก่า", "food", "Kyoto", "Gion", ["tag-cafe"]),
    place(J, "j-inari", "ศาลเจ้าฟุชิมิอินาริ", "sight", "Kyoto", "Fushimi"),
    place(J, "j-soba", "ร้านโซบะที่เพื่อนแนะนำ", "food", "Kyoto", null, ["tag-soba"], "n"),
    place(J, "j-dotonbori", "โดทงโบริ", "interest", "Osaka", "Namba"),
    place(J, "j-takoyaki", "ร้านทาโกะยากิริมคลอง", "food", "Osaka", "Namba", ["tag-street"], "n"),
    place(J, "j-wagyu", "ปิ้งย่างเนื้อวัวโอซาก้า", "food", "Osaka", "Namba", ["tag-yakiniku", "tag-booking"]),
    place(J, "j-umeda-ramen", "ราเมงย่านอุเมดะ", "food", "Osaka", "Umeda", ["tag-ramen"], "n"),
  ];

  // ── Plan (Planner.dc.html) ──
  const ownerOf = (tripId: string) => members.find((m) => m.tripId === tripId && m.role === "owner")!.id;
  const visit = (tripId: string, id: string, day: number, time: string | null, placeId: string, note = "", travelToNext?: Hop): PlanItem => ({
    kind: "place",
    id,
    tripId,
    day,
    time,
    placeId,
    note,
    ...(travelToNext ? { travelToNext } : {}),
    // Seeded plan items belong to the trip owner (first-frontend.md "สิทธิ์แก้ไข").
    createdBy: ownerOf(tripId),
  });

  const planItems: PlanItem[] = [
    {
      kind: "transit",
      id: "t-flight-out",
      tripId: T,
      createdBy: memberId(T, "act"),
      mode: "plane",
      fromCode: "BKK",
      fromText: "สุวรรณภูมิ",
      toCode: "HND",
      toText: "สนามบินฮาเนดะ",
      departAt: "2026-12-12T00:30",
      arriveAt: "2026-12-12T08:30",
      durationMinutes: 360,
      bookingRef: "ABC123",
      seatInfo: "ที่นั่ง 32A–32D",
      docIds: ["doc-flight"],
      toPlaceId: "t-haneda",
      travelToNext: { mode: "train", minutes: 40, note: "ไปชินจูกุ" },
    },
    visit(T, "t-p1", 1, "11:00", "t-hotel", "ฝากกระเป๋า · เช็คอิน 15:00", { mode: "walk", minutes: 10 }),
    visit(T, "t-p2", 1, "19:00", "t-ramen", "คิวยาวช่วงเย็น"),
    visit(T, "t-p3", 2, "09:00", "t-sensoji", "ไปเช้าก่อนคนเยอะ", { mode: "walk", minutes: 20, note: "ข้ามสะพานอาซึมะ" }),
    visit(T, "t-p4", 2, "11:30", "t-skytree", "จองตั๋วล่วงหน้าแล้ว"),
    visit(T, "t-p5", 2, "18:00", "t-shabu", "จำกัดเวลา 90 นาที"),
    visit(T, "t-p6", 3, "14:00", "t-shibuya", "ถ่ายรูปจากชั้นบนของร้านกาแฟ", { mode: "train", minutes: 10, note: "JR Yamanote" }),
    visit(T, "t-p7", 3, "19:00", "t-yakiniku", "จองโต๊ะ 4 ที่"),
    visit(T, "t-p8", 4, "10:00", "t-hotel", "เช็คเอาท์", { mode: "train", minutes: 15 }),
    visit(T, "t-p9", 4, "12:00", "t-omiyage", "ซื้อของฝากก่อนกลับ", { mode: "train", minutes: 35, note: "ถึงสนามบินก่อน 2 ชม." }),
    {
      kind: "transit",
      id: "t-flight-back",
      tripId: T,
      createdBy: memberId(T, "act"),
      mode: "plane",
      fromCode: "HND",
      fromText: "สนามบินฮาเนดะ",
      toCode: "BKK",
      toText: "สุวรรณภูมิ",
      departAt: "2026-12-15T18:00",
      arriveAt: "2026-12-15T23:30",
      durationMinutes: 450,
      bookingRef: "ABC123",
      docIds: ["doc-flight"],
      fromPlaceId: "t-haneda",
    },
    // Japan — days from PlacesJP.dc.html; times are illustrative.
    visit(J, "j-p1", 1, "15:00", "j-hotel", "เช็คอิน"),
    visit(J, "j-p2", 1, "19:00", "j-station-ramen"),
    visit(J, "j-p3", 2, null, "j-hotel"),
    visit(J, "j-p4", 2, "18:00", "j-omoide"),
    visit(J, "j-p5", 2, "20:00", "j-ramen"),
    visit(J, "j-p6", 3, null, "j-hotel"),
    visit(J, "j-p7", 3, "09:00", "j-sensoji"),
    visit(J, "j-p8", 3, "18:00", "j-shabu"),
    visit(J, "j-p9", 4, "10:00", "j-hotel", "เช็คเอาท์"),
    visit(J, "j-p10", 5, "08:00", "j-inari", "ไปเช้าก่อนคนเยอะ"),
    visit(J, "j-p11", 7, "18:00", "j-dotonbori"),
    visit(J, "j-p12", 7, "19:30", "j-takoyaki"),
  ];

  // ── Expenses (Summary.dc.html + Expenses.dc.html) ──
  const tokyoExpenses: ExpenseSeed[] = [
    { id: "e-hotel", title: "ที่พัก 3 คืน", category: "stay", payer: "act", method: "card", cardLast4: "4821", amountBaht: 22000, with: ["act", "mint", "beam", "ploy"], date: "2026-12-12", note: "โรงแรมใกล้สถานีชินจูกุ 2 ห้อง เช็คอิน 15:00 เช็คเอาท์ 10:00", createdAt: "2026-11-08T14:30:00.000Z" },
    { id: "e-subway", title: "Tokyo Subway Ticket 72 ชม.", category: "transport", payer: "beam", method: "cash", amountBaht: 1050, with: ["act", "beam", "ploy"], date: "2026-12-12", createdAt: "2026-11-09T03:10:00.000Z" },
    { id: "e-ramen", title: "ร้านราเมงซุปเข้มข้น", category: "food", payer: "mint", method: "cash", amountBaht: 1200, with: ["act", "mint", "beam", "ploy"], date: "2026-12-12", createdAt: "2026-11-09T12:00:00.000Z" },
    { id: "e-skytree", title: "ตั๋ว Tokyo Skytree", category: "activity", payer: "ploy", method: "promptpay", amountBaht: 2800, with: ["act", "mint", "beam", "ploy"], date: "2026-12-13", createdAt: "2026-11-09T13:20:00.000Z" },
    { id: "e-shabu", title: "ชาบูบุฟเฟ่ต์", category: "food", payer: "mint", method: "card", amountBaht: 3300, with: ["act", "mint", "ploy"], date: "2026-12-13", createdAt: hoursAgo(now, 2) },
  ];

  // Khao Yai: total ฿7,860, all split equally among 3. Act paid ฿2,100 and
  // already paid Mint ฿200 back, so Act's Outstanding is −฿320 (Trips mockup).
  const khaoYaiExpenses: ExpenseSeed[] = [
    { id: "k-resort", title: "รีสอร์ต 1 คืน", category: "stay", payer: "mint", method: "promptpay", amountBaht: 4800, with: ["mint", "act", "kong"], date: "2026-06-13", createdAt: "2026-06-13T08:00:00.000Z" },
    { id: "k-bbq", title: "หมูกระทะริมเขา", category: "food", payer: "act", method: "cash", amountBaht: 2100, with: ["mint", "act", "kong"], date: "2026-06-13", createdAt: "2026-06-13T13:00:00.000Z" },
    { id: "k-fuel", title: "ค่าน้ำมันและทางด่วน", category: "transport", payer: "kong", method: "card", amountBaht: 960, with: ["mint", "act", "kong"], date: "2026-06-14", createdAt: "2026-06-14T09:00:00.000Z" },
  ];

  // Koh Larn: total ฿4,200, split equally; Beam and Ploy each paid Act ฿500 → all ฿0.
  const kohLarnExpenses: ExpenseSeed[] = [
    { id: "l-room", title: "ที่พักริมหาด", category: "stay", payer: "act", method: "promptpay", amountBaht: 2400, with: ["act", "beam", "ploy"], date: "2026-08-08", createdAt: "2026-08-08T06:00:00.000Z" },
    { id: "l-boat", title: "เรือและรถสองแถว", category: "transport", payer: "beam", method: "cash", amountBaht: 900, with: ["act", "beam", "ploy"], date: "2026-08-08", createdAt: "2026-08-08T03:00:00.000Z" },
    { id: "l-seafood", title: "อาหารทะเล", category: "food", payer: "ploy", method: "cash", amountBaht: 900, with: ["act", "beam", "ploy"], date: "2026-08-08", createdAt: "2026-08-08T12:00:00.000Z" },
  ];

  const expenses: Expense[] = [
    ...tokyoExpenses.map((e) => equalExpense(T, e)),
    ...khaoYaiExpenses.map((e) => equalExpense(K, e)),
    ...kohLarnExpenses.map((e) => equalExpense(L, e)),
  ];

  // ── Settlements ──
  const settlements: Settlement[] = [
    { id: "s-mint", tripId: T, fromId: memberId(T, "mint"), toId: memberId(T, "act"), amount: 310_000, status: "confirmed", createdAt: hoursAgo(now, 30), sentAt: hoursAgo(now, 30), confirmedAt: hoursAgo(now, 26.5) },
    { id: "s-beam", tripId: T, fromId: memberId(T, "beam"), toId: memberId(T, "act"), amount: 580_000, status: "sent", slipDocId: "slip-beam", createdAt: hoursAgo(now, 1), sentAt: hoursAgo(now, 1) },
    { id: "s-k-act", tripId: K, fromId: memberId(K, "act"), toId: memberId(K, "mint"), amount: 20_000, status: "confirmed", createdAt: "2026-06-15T05:00:00.000Z", sentAt: "2026-06-15T05:00:00.000Z", confirmedAt: "2026-06-15T07:00:00.000Z" },
    { id: "s-l-beam", tripId: L, fromId: memberId(L, "beam"), toId: memberId(L, "act"), amount: 50_000, status: "confirmed", createdAt: "2026-08-10T04:00:00.000Z", sentAt: "2026-08-10T04:00:00.000Z", confirmedAt: "2026-08-10T05:00:00.000Z" },
    { id: "s-l-ploy", tripId: L, fromId: memberId(L, "ploy"), toId: memberId(L, "act"), amount: 50_000, status: "confirmed", createdAt: "2026-08-10T06:00:00.000Z", sentAt: "2026-08-10T06:00:00.000Z", confirmedAt: "2026-08-10T08:00:00.000Z" },
  ];

  // ── Checklist (Checklist.dc.html) ──
  let checklistSeq = 0;
  const group = (text: string, category: string, assignee: string | null, done: boolean): ChecklistItem => {
    const assigneeId = assignee ? memberId(T, assignee) : undefined;
    return {
      id: `c-${++checklistSeq}`,
      tripId: T,
      scope: "group",
      text,
      category,
      ...(assigneeId ? { assigneeId } : {}),
      done,
      ...(done && assigneeId ? { doneBy: assigneeId } : {}),
      fromTemplate: category !== "เพิ่มเอง",
    };
  };
  const personal = (text: string, category: string, done: boolean): ChecklistItem => ({
    id: `c-${++checklistSeq}`,
    tripId: T,
    scope: "personal",
    ownerId: memberId(T, "act"),
    text,
    category,
    done,
    ...(done ? { doneBy: memberId(T, "act") } : {}),
    fromTemplate: true,
  });
  const checklist: ChecklistItem[] = [
    group("จองตั๋วเครื่องบิน", "การจอง", "act", true),
    group("จองที่พัก", "การจอง", "act", true),
    group("ซื้อประกันเดินทาง", "การจอง", "mint", false),
    group("จองตั๋ว Tokyo Skytree", "การจอง", "ploy", true),
    group("eSIM หรือ pocket wifi", "ใช้ร่วมกัน", "beam", false),
    group("ปลั๊กแปลงไฟ", "ใช้ร่วมกัน", null, false),
    group("ยาสามัญประจำบ้าน", "ใช้ร่วมกัน", "mint", false),
    group("จองร้านยากินิคุ วันที่ 3", "เพิ่มเอง", "act", false),
    personal("พาสปอร์ต", "เอกสาร", true),
    personal("บัตรเครดิต และเงินสดเยน", "เอกสาร", false),
    personal("เสื้อกันหนาว", "เสื้อผ้า", false),
    personal("รองเท้าเดินสบาย", "เสื้อผ้า", true),
    personal("ที่ชาร์จและพาวเวอร์แบงก์", "ของใช้", false),
    personal("ยาประจำตัว", "ของใช้", false),
  ];

  // ── Activity (Activity.dc.html), relative to server start ──
  const activity: Activity[] = [
    { id: "a-1", tripId: T, actorId: memberId(T, "beam"), type: "settlement", refId: "s-beam", text: "แจ้งโอนเงินให้ Act ฿5,800 พร้อมแนบสลิป", createdAt: hoursAgo(now, 1), readBy: [] },
    { id: "a-2", tripId: T, actorId: memberId(T, "mint"), type: "expense", refId: "e-shabu", text: "เพิ่มค่าใช้จ่าย \"ชาบูบุฟเฟ่ต์\" ฿3,300", createdAt: hoursAgo(now, 2), readBy: [] },
    { id: "a-3", tripId: T, actorId: memberId(T, "mint"), type: "plan", refId: "t-p4", text: "ย้าย \"Tokyo Skytree\" เป็น 11:30 ในวันที่ 2", createdAt: hoursAgo(now, 4.5), readBy: [] },
    { id: "a-4", tripId: T, actorId: memberId(T, "beam"), type: "member", refId: memberId(T, "beam"), text: "เข้าร่วมทริปผ่าน LINE", createdAt: hoursAgo(now, 24), readBy: ["act"] },
    { id: "a-5", tripId: T, actorId: memberId(T, "mint"), type: "settlement", refId: "s-mint", text: "โอนคืนให้ Act ฿3,100 · Act ยืนยันแล้ว", createdAt: hoursAgo(now, 26.5), readBy: ["act"] },
    { id: "a-6", tripId: T, actorId: memberId(T, "mint"), type: "plan", refId: "t-cafe", text: "เพิ่มสถานที่ \"คาเฟ่ใต้ทางรถไฟ\" ใน Akihabara", createdAt: hoursAgo(now, 32), readBy: ["act"] },
  ];

  return {
    users: users.map((u) => ({ ...u })),
    trips,
    members,
    invites,
    documents,
    places,
    tags,
    planItems,
    expenses,
    settlements,
    checklist,
    activity,
    seq: 1000,
  };
}

/** Suggested checklist items (Checklist.dc.html). */
export const CHECKLIST_SUGGESTIONS = {
  group: ["แลกเงินเยน", "บัตรรถไฟ", "ร่มพับ"],
  personal: ["ลิปบาล์ม / ครีมทามือ", "ถุงสำหรับของฝาก", "ปากกาสำหรับกรอกฟอร์ม"],
} as const;
