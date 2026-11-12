/** Thai labels for enum values shown in the UI (pure, safe for client components). */
import type { ExpenseCategory, HopMode, Member, PaymentMethod, Role, SplitMode, TransitMode } from "@/lib/api/types";

export const roleLabel: Record<Role, string> = {
  owner: "ผู้จัดทริป",
  editor: "แก้ไขได้",
  viewer: "ดูอย่างเดียว",
};

/**
 * Short role line on the trip page (Main mockup): "คุณ · ผู้จัดทริป" / "สมาชิก".
 * Editors read as plain "สมาชิก" there; the Members page uses the full role names.
 */
export function memberRoleLine(member: Pick<Member, "role" | "userId">, isMe: boolean): string {
  const role = member.role === "editor" ? "สมาชิก" : roleLabel[member.role];
  const parts = [isMe ? "คุณ" : null, role, member.userId === null ? "ยังไม่เข้าร่วม" : null];
  return parts.filter(Boolean).join(" · ");
}

export const transitModeLabel: Record<TransitMode, string> = {
  plane: "เครื่องบิน",
  train: "รถไฟ",
  bus: "รถบัส",
  car: "รถยนต์",
  boat: "เรือ",
  other: "การเดินทาง",
};

export const hopModeLabel: Record<HopMode, string> = {
  walk: "เดิน",
  train: "รถไฟ",
  bus: "รถบัส",
  taxi: "แท็กซี่",
  car: "รถเช่า",
};

/** 360 → "6 ชม.", 450 → "7 ชม. 30 นาที", 40 → "40 นาที". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} นาที`;
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

/** AddExpense category pills (AddExpense.dc.html order and wording). */
export const expenseCategoryFormLabel: Record<ExpenseCategory, string> = {
  stay: "ที่พัก",
  transport: "เดินทาง",
  food: "อาหาร",
  activity: "ตั๋ว/กิจกรรม",
  other: "อื่นๆ",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  promptpay: "โอน / พร้อมเพย์",
  card: "บัตรเครดิต/เดบิต",
  wallet: "e-Wallet",
};

export const splitModeLabel: Record<SplitMode, { label: string; hint: string; title: string }> = {
  equal: { label: "เท่ากัน", hint: "ทุกคนจ่ายเท่ากัน เศษสตางค์รวมไว้กับผู้จ่าย", title: "หารเท่ากัน" },
  amount: { label: "ระบุจำนวน", hint: "ใส่ยอดของแต่ละคนเอง เช่น คนที่ไม่ดื่มจ่ายน้อยกว่า", title: "ระบุจำนวน" },
  shares: { label: "ตามสัดส่วน", hint: "นับเป็นส่วน เช่น ห้องใหญ่นับ 2 ส่วน ห้องเล็ก 1 ส่วน", title: "ตามสัดส่วน" },
};
