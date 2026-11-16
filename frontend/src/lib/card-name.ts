/** Card name ("UOB", "KBank", "UOB PRVI") for card payments; replaces the legacy last-4 digits input. */
import type { Expense, PersonalExpense } from "@/lib/api/types";

export const MAX_CARD_NAME = 30;

/** Common Thai banks, offered after the names already used in the trip. */
export const COMMON_CARD_NAMES: readonly string[] = ["KBank", "SCB", "KTC", "UOB", "กรุงศรี", "BBL", "ttb"];

export type CardNameCheck = { ok: true; cardName?: string } | { ok: false; error: string };

/** Trim; blank = absent; at most MAX_CARD_NAME characters. */
export function checkCardName(raw: string | undefined): CardNameCheck {
  const name = (raw ?? "").trim();
  if (name.length > MAX_CARD_NAME) return { ok: false, error: `ชื่อบัตรยาวได้ไม่เกิน ${MAX_CARD_NAME} ตัวอักษร` };
  return name ? { ok: true, cardName: name } : { ok: true };
}

/** Distinct card names across the given expense lists, in first-seen order. */
export function usedCardNames(...lists: ReadonlyArray<ReadonlyArray<Pick<Expense | PersonalExpense, "cardName">>>): string[] {
  return dedupeCardNames(lists.flatMap((l) => l.map((e) => e.cardName ?? "")));
}

/** Trimmed, non-empty, case-insensitive distinct (first spelling wins). */
export function dedupeCardNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const name = n.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Quick-pick chips: names used in this trip first, then the common banks not already listed. */
export function cardNameChips(used: readonly string[]): string[] {
  return dedupeCardNames([...used, ...COMMON_CARD_NAMES]);
}
