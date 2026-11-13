import { describe, expect, it } from "vitest";
import { createSeed, memberId, TRIP_IDS } from "@/test/fixtures/seed";
import { outstandingBalances } from "@/lib/money/balance";
import { suggestTransfers } from "@/lib/money/settle";
import { categoryTotals, equalShareAmount, groupExpensesByDay, personalTotals, shareBreakdown, suggestedRow, transferRows, unreadCount } from "./expenses";

const seed = createSeed(new Date("2026-11-11T10:00:00Z"));
const T = TRIP_IDS.tokyo;
const tokyo = seed.trips.find((t) => t.id === T)!;
const expenses = seed.expenses.filter((e) => e.tripId === T).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
const m = (k: string) => memberId(T, k);

describe("groupExpensesByDay", () => {
  it("groups the Tokyo expenses into 2 days like the mockup", () => {
    const days = groupExpensesByDay(expenses, tokyo);
    expect(days.map((d) => [d.label, d.total, d.items.length])).toEqual([
      ["ส. 12 ธ.ค. · วันที่ 1", 2_425_000, 3],
      ["อา. 13 ธ.ค. · วันที่ 2", 610_000, 2],
    ]);
  });

  it("labels dates outside the trip without a day number", () => {
    const days = groupExpensesByDay([{ ...expenses[0], date: "2026-11-30" }], tokyo);
    expect(days[0]).toMatchObject({ day: null, label: "จ. 30 พ.ย." });
  });
});

describe("equalShareAmount", () => {
  it("returns the per-person amount for equal splits", () => {
    expect(expenses.map(equalShareAmount)).toEqual([550_000, 35_000, 30_000, 70_000, 110_000]);
  });
  it("tolerates the remainder on the payer but not uneven splits", () => {
    const shares = [{ memberId: "a", amount: 3_334 }, { memberId: "b", amount: 3_333 }, { memberId: "c", amount: 3_333 }];
    expect(equalShareAmount({ amount: 10_000, shares })).toBe(3_333);
    expect(equalShareAmount({ amount: 10_000, shares: [{ memberId: "a", amount: 7_000 }, { memberId: "b", amount: 3_000 }] })).toBeNull();
  });
});

describe("categoryTotals", () => {
  it("rounds each category (mockup shows 4% for transport; 1,050 / 30,350 is 3.46%)", () => {
    expect(categoryTotals(expenses)).toEqual([
      { category: "stay", amount: 2_200_000, percent: 72 },
      { category: "food", amount: 450_000, percent: 15 },
      { category: "activity", amount: 280_000, percent: 9 },
      { category: "transport", amount: 105_000, percent: 3 },
    ]);
  });
  it("is empty without expenses", () => {
    expect(categoryTotals([])).toEqual([]);
  });
});

describe("personalTotals", () => {
  it("sums my own records and breaks them down by category, shopping included", () => {
    const records = [
      { category: "shopping" as const, amount: 300_000 },
      { category: "food" as const, amount: 45_050 },
      { category: "shopping" as const, amount: 120_000 },
      { category: "transport" as const, amount: 21_000 },
    ];
    expect(personalTotals(records)).toEqual({
      total: 486_050,
      byCategory: [
        { category: "shopping", amount: 420_000, percent: 86 },
        { category: "food", amount: 45_050, percent: 9 },
        { category: "transport", amount: 21_000, percent: 4 },
      ],
    });
  });
  it("is zero and empty without records", () => {
    expect(personalTotals([])).toEqual({ total: 0, byCategory: [] });
  });
});

describe("groupExpensesByDay with Personal Expenses", () => {
  it("groups records that have no Shares", () => {
    const days = groupExpensesByDay(
      [
        { id: "p1", date: "2026-12-13", amount: 300_000 },
        { id: "p2", date: "2026-12-12", amount: 45_050 },
        { id: "p3", date: "2026-12-13", amount: 21_000 },
      ],
      tokyo,
    );
    expect(days.map((d) => [d.label, d.total, d.items.map((i) => i.id)])).toEqual([
      ["ส. 12 ธ.ค. · วันที่ 1", 45_050, ["p2"]],
      ["อา. 13 ธ.ค. · วันที่ 2", 321_000, ["p1", "p3"]],
    ]);
  });
});

describe("shareBreakdown", () => {
  it("lists Ploy's 4 shares (= ฿7,950)", () => {
    const lines = shareBreakdown(m("ploy"), expenses);
    expect(lines.map((l) => [l.title, l.basis, l.amount])).toEqual([
      ["ที่พัก 3 คืน", "÷4", 550_000],
      ["Tokyo Subway Ticket 72 ชม.", "÷3", 35_000],
      ["ร้านราเมงซุปเข้มข้น", "÷4", 30_000],
      ["ตั๋ว Tokyo Skytree", "÷4", 70_000],
      ["ชาบูบุฟเฟ่ต์", "÷3", 110_000],
    ]);
    expect(lines.reduce((a, l) => a + l.amount, 0)).toBe(795_000);
  });
  it("describes shares-mode weights", () => {
    const e = { id: "x", title: "ห้อง", splitMode: "shares" as const, shares: [{ memberId: "a", amount: 200, weight: 2 }, { memberId: "b", amount: 100, weight: 1 }] };
    expect(shareBreakdown("a", [e])[0].basis).toBe("2/3 ส่วน");
  });
});

describe("transferRows", () => {
  it("shows Mint cleared, Beam waiting, Ploy to pay (Summary mockup)", () => {
    const members = seed.members.filter((x) => x.tripId === T).map((x) => x.id);
    const settlements = seed.settlements.filter((s) => s.tripId === T);
    const suggested = suggestTransfers(outstandingBalances(members, expenses, settlements)).map((t) => ({
      ...t,
      settlementStatus: settlements.find((s) => s.fromId === t.fromId && s.toId === t.toId && s.amount === t.amount)?.status ?? null,
    }));
    expect(transferRows(members, settlements, suggested).map((r) => [r.fromId, r.toId, r.amount, r.status])).toEqual([
      [m("mint"), m("act"), 310_000, "confirmed"],
      [m("beam"), m("act"), 580_000, "sent"],
      [m("ploy"), m("act"), 515_000, "pending"],
    ]);
  });
});

describe("unreadCount", () => {
  it("counts activity the User has not read, skipping their own", () => {
    const activity = seed.activity.filter((a) => a.tripId === T);
    expect(unreadCount(activity, "act", m("act"))).toBe(3);
    expect(unreadCount(activity, "mint", m("mint"))).toBe(2);
    expect(unreadCount(activity, "ploy", m("ploy"))).toBe(6);
  });
});

describe("suggestedRow", () => {
  const t = { from: { id: "beam" }, to: { id: "act" }, amount: 580_000 };
  it("shows the suggestion when nothing is reported", () => {
    expect(suggestedRow({ ...t, settlement: null })).toEqual({ fromId: "beam", toId: "act", amount: 580_000, settlementStatus: null });
  });
  it("shows the reported amount while a report is sent", () => {
    expect(suggestedRow({ ...t, settlement: { amount: 280_000, status: "sent" } }).amount).toBe(280_000);
    expect(suggestedRow({ ...t, settlement: { amount: 280_000, status: "pending" } }).amount).toBe(580_000);
  });
});
