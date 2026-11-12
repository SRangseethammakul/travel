/** Default checklist items (SPEC "เช็คลิสต์") and suggestions (Checklist mockup). Static data. */

export interface ChecklistTemplateItem {
  text: string;
  category: string;
}

/** Group items every new trip starts with. */
export const GROUP_TEMPLATE: ChecklistTemplateItem[] = [
  { text: "จองตั๋วเครื่องบิน", category: "การจอง" },
  { text: "จองที่พัก", category: "การจอง" },
  { text: "ซื้อประกันเดินทาง", category: "การจอง" },
  { text: "จองตั๋วกิจกรรม", category: "การจอง" },
  { text: "eSIM หรือ pocket wifi", category: "ใช้ร่วมกัน" },
  { text: "ปลั๊กแปลงไฟ", category: "ใช้ร่วมกัน" },
  { text: "ยาสามัญประจำบ้าน", category: "ใช้ร่วมกัน" },
];

/** Personal items each User starts with when they become a Member. */
export const PERSONAL_TEMPLATE: ChecklistTemplateItem[] = [
  { text: "พาสปอร์ต", category: "เอกสาร" },
  { text: "บัตรเครดิต และเงินสด", category: "เอกสาร" },
  { text: "เสื้อผ้าตามสภาพอากาศ", category: "เสื้อผ้า" },
  { text: "รองเท้าเดินสบาย", category: "เสื้อผ้า" },
  { text: "ที่ชาร์จและพาวเวอร์แบงก์", category: "ของใช้" },
  { text: "ยาประจำตัว", category: "ของใช้" },
];

/** Extra ideas the user can tap to add (not inserted automatically). */
export const SUGGESTIONS: Record<"group" | "personal", ChecklistTemplateItem[]> = {
  group: [
    { text: "แลกเงิน", category: "เพิ่มเอง" },
    { text: "บัตรรถไฟ", category: "เพิ่มเอง" },
    { text: "ร่มพับ", category: "เพิ่มเอง" },
  ],
  personal: [
    { text: "ลิปบาล์ม / ครีมทามือ", category: "ของใช้" },
    { text: "ถุงสำหรับของฝาก", category: "ของใช้" },
    { text: "ปากกาสำหรับกรอกฟอร์ม", category: "ของใช้" },
  ],
};
