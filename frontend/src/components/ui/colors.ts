import type { ColorKey, ExpenseCategory, PlaceType } from "@/lib/api/types";

/**
 * Data colour keys → token classes. Literal strings so Tailwind can see them.
 * Member avatars and trip covers use the same keys.
 */
export const solidBg: Record<ColorKey, string> = {
  teal: "bg-primary",
  blue: "bg-type-interest",
  orange: "bg-type-food",
  purple: "bg-type-transit",
  slate: "bg-type-stay",
  gray: "bg-ink-muted",
  ink: "bg-ink",
};

/** Place type → colour bar (bg) and label text. */
export const placeTypeStyle: Record<PlaceType, { label: string; bar: string; text: string; tint: string }> = {
  sight: { label: "ที่เที่ยว", bar: "bg-type-sight", text: "text-type-sight", tint: "bg-primary-soft" },
  food: { label: "ที่กิน", bar: "bg-type-food", text: "text-type-food", tint: "bg-todo-soft" },
  interest: { label: "น่าสนใจ", bar: "bg-type-interest", text: "text-type-interest", tint: "bg-interest-soft" },
  stay: { label: "ที่พัก", bar: "bg-type-stay", text: "text-type-stay", tint: "bg-stay-soft" },
  transit: { label: "เดินทาง", bar: "bg-type-transit", text: "text-type-transit", tint: "bg-transit-soft" },
};

/**
 * Expense category → Summary label, Expenses list badge (abbr on a tint) and
 * Summary bar colour. Badge colours follow Expenses.dc.html, bar colours Summary.dc.html.
 */
export const expenseCategoryStyle: Record<ExpenseCategory, { label: string; abbr: string; tint: string; ink: string; bar: string }> = {
  stay: { label: "ที่พัก", abbr: "พัก", tint: "bg-primary-soft", ink: "text-primary", bar: "bg-primary" },
  food: { label: "อาหาร", abbr: "กิน", tint: "bg-todo-soft", ink: "text-type-food", bar: "bg-chart-food" },
  activity: { label: "กิจกรรม", abbr: "ตั๋ว", tint: "bg-transit-soft", ink: "text-type-transit", bar: "bg-type-transit" },
  transport: { label: "เดินทาง", abbr: "เดินทาง", tint: "bg-interest-soft", ink: "text-type-interest", bar: "bg-type-interest" },
  other: { label: "อื่นๆ", abbr: "อื่นๆ", tint: "bg-stay-soft", ink: "text-type-stay", bar: "bg-type-stay" },
};
