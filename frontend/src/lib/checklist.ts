/**
 * Checklist helpers (pure). Starter items are created by the backend.
 */
import type { ChecklistItem } from "@/lib/api/types";

/** Category for items people type themselves or pick from suggestions. */
export const CUSTOM_CATEGORY = "เพิ่มเอง";

export interface ChecklistGroup {
  category: string;
  items: ChecklistItem[];
}

/** Items grouped by category in order of first appearance; "เพิ่มเอง" always last. */
export function groupChecklist(items: readonly ChecklistItem[]): ChecklistGroup[] {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups]
    .map(([category, list]) => ({ category, items: list }))
    .sort((a, b) => Number(a.category === CUSTOM_CATEGORY) - Number(b.category === CUSTOM_CATEGORY));
}

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** Suggestions not already on the list (compared ignoring case and extra spaces). */
export function remainingSuggestions(suggestions: readonly string[], items: readonly Pick<ChecklistItem, "text">[]): string[] {
  const have = new Set(items.map((i) => normalize(i.text)));
  return suggestions.filter((s) => !have.has(normalize(s)));
}

export const MAX_CHECKLIST_TEXT = 120;
