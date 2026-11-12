/**
 * Activity page (21) helpers. Pure.
 */
import type { Activity, ActivityType, ID } from "@/lib/api/types";
import { daysBetween, formatDate, todayISO } from "@/lib/date";

export type ActivityFilter = "all" | ActivityType;

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "expense", label: "ค่าใช้จ่าย" },
  { value: "settlement", label: "การโอน" },
  { value: "plan", label: "แผนและสถานที่" },
  { value: "member", label: "สมาชิก" },
];

export function parseActivityFilter(value: string | undefined): ActivityFilter {
  return ACTIVITY_FILTERS.some((f) => f.value === value) ? (value as ActivityFilter) : "all";
}

/** Unread for this viewer: not their own action and not read by their User. */
export function isUnread(a: Pick<Activity, "actorId" | "readBy">, userId: ID, memberId: ID): boolean {
  return a.actorId !== memberId && !a.readBy.includes(userId);
}

export interface ActivityDay<A> {
  /** "วันนี้" / "เมื่อวาน" / "ส. 8 พ.ย. 2569" (Bangkok time). */
  title: string;
  items: A[];
}

/** Group newest-first Activity by Bangkok calendar day, keeping order. */
export function groupActivityByDay<A extends Pick<Activity, "createdAt">>(items: readonly A[], now: Date): ActivityDay<A>[] {
  const today = todayISO(now);
  const groups: ActivityDay<A>[] = [];
  let lastDay = "";
  for (const item of items) {
    const day = todayISO(new Date(item.createdAt));
    if (day !== lastDay) {
      const diff = daysBetween(day, today);
      groups.push({ title: diff === 0 ? "วันนี้" : diff === 1 ? "เมื่อวาน" : formatDate(day), items: [] });
      lastDay = day;
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

/**
 * Activity text is stored with names ("แจ้งโอนเงินให้ Act ฿5,800"). When the
 * named person is the viewer, read it as "คุณ" like the mockup.
 */
export function personalizeText(text: string, myName: string): string {
  if (!myName) return text;
  return text
    .split(`ให้ ${myName} `).join("ให้คุณ ")
    .split(`จาก ${myName} `).join("จากคุณ ")
    .split(`เตือน ${myName} `).join("เตือนคุณ ")
    .split(`· ${myName} ยืนยันแล้ว`).join("· คุณยืนยันแล้ว");
}
