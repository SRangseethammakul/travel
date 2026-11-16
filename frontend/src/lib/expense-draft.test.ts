import { describe, expect, it } from "vitest";
import { checkExpenseDraft, defaultExpenseDate, type ExpenseDraft } from "./expense-draft";

const trip = { startDate: "2026-12-12", endDate: "2026-12-15" };
const members = ["act", "mint", "beam", "ploy"];

const base: ExpenseDraft = {
  title: " ยากินิคุหลังสถานี ",
  category: "food",
  payerId: "act",
  method: "promptpay",
  date: "2026-12-14",
  amount: 480_000,
  splitMode: "amount",
  participantIds: members,
  amounts: { act: 120_000, mint: 90_000, beam: 135_000, ploy: 135_000 },
};

describe("checkExpenseDraft", () => {
  it("accepts the AddExpense mockup example (฿4,800 split by amount)", () => {
    const r = checkExpenseDraft(base, members, trip);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.title).toBe("ยากินิคุหลังสถานี");
      expect(r.shares.map((s) => s.amount)).toEqual([120_000, 90_000, 135_000, 135_000]);
    }
  });

  it("rejects amounts that do not add up exactly", () => {
    const r = checkExpenseDraft({ ...base, amounts: { ...base.amounts, act: 119_999 } }, members, trip);
    expect(r).toEqual({ ok: false, error: "ยอดที่แบ่งยังไม่ตรงกับจำนวนเงิน" });
  });

  it("recomputes equal splits with the remainder on the payer", () => {
    const r = checkExpenseDraft({ ...base, splitMode: "equal", amount: 100_001, amounts: undefined, payerId: "mint" }, members, trip);
    expect(r.ok && r.shares.find((s) => s.memberId === "mint")?.amount).toBe(25_001);
  });

  it("keeps weights for shares mode", () => {
    const r = checkExpenseDraft({ ...base, splitMode: "shares", weights: { act: 2 }, amounts: undefined, amount: 500_000 }, members, trip);
    expect(r.ok && r.shares.map((s) => [s.amount, s.weight])).toEqual([
      [200_000, 2],
      [100_000, 1],
      [100_000, 1],
      [100_000, 1],
    ]);
  });

  it("rejects unknown members, empty title, dates outside the trip and a card name over 30 characters", () => {
    expect(checkExpenseDraft({ ...base, payerId: "kong" }, members, trip).ok).toBe(false);
    expect(checkExpenseDraft({ ...base, participantIds: ["act", "kong"] }, members, trip).ok).toBe(false);
    expect(checkExpenseDraft({ ...base, title: "  " }, members, trip).ok).toBe(false);
    expect(checkExpenseDraft({ ...base, date: "2026-12-16" }, members, trip).ok).toBe(false);
    expect(checkExpenseDraft({ ...base, method: "card", cardName: "x".repeat(31) }, members, trip).ok).toBe(false);
    expect(checkExpenseDraft({ ...base, amount: 0 }, members, trip).ok).toBe(false);
  });

  it("drops the card name for other payment methods", () => {
    const r = checkExpenseDraft({ ...base, method: "cash", cardName: "UOB" }, members, trip);
    expect(r.ok && r.cardName).toBeUndefined();
  });

  it("trims the card name and treats blank as none", () => {
    const named = checkExpenseDraft({ ...base, method: "card", cardName: "  UOB PRVI " }, members, trip);
    expect(named.ok && named.cardName).toBe("UOB PRVI");
    const blank = checkExpenseDraft({ ...base, method: "card", cardName: "   " }, members, trip);
    expect(blank.ok && blank.cardName).toBeUndefined();
  });
});

describe("defaultExpenseDate", () => {
  it("clamps today into the trip", () => {
    expect(defaultExpenseDate("2026-11-11", trip)).toBe("2026-12-12");
    expect(defaultExpenseDate("2026-12-13", trip)).toBe("2026-12-13");
    expect(defaultExpenseDate("2027-01-01", trip)).toBe("2026-12-15");
  });
});
