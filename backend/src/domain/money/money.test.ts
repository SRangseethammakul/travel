import { describe, expect, it } from "vitest";
import { netBalances, outstandingBalances, totalSpent, type BalanceSettlement } from "./balance.js";
import { suggestTransfers, type SuggestedTransfer } from "./settle.js";
import { split, SplitError } from "./split.js";

const all = ["act", "mint", "beam", "ploy"];
const equal = (payerId: string, total: number, ids: string[]) => ({
  payerId,
  amount: total,
  shares: split({ mode: "equal", total, payerId, shares: ids.map((memberId) => ({ memberId })) }),
});

// Tokyo trip (docs/design/screens/Summary.dc.html), satang.
const tokyoExpenses = [
  equal("act", 2_200_000, all), // ที่พัก 3 คืน
  equal("beam", 105_000, ["act", "beam", "ploy"]), // Tokyo Subway Ticket
  equal("mint", 120_000, all), // ราเมง
  equal("ploy", 280_000, all), // Skytree
  equal("mint", 330_000, ["act", "mint", "ploy"]), // ชาบู
];
const tokyoSettlements: BalanceSettlement[] = [
  { fromId: "mint", toId: "act", amount: 310_000, status: "confirmed" },
  { fromId: "beam", toId: "act", amount: 580_000, status: "sent" },
];
const byId = (shares: { memberId: string; amount: number }[]) => Object.fromEntries(shares.map((s) => [s.memberId, s.amount]));

describe("split", () => {
  it("equal: leftover satang goes to the payer", () => {
    const shares = split({ mode: "equal", total: 100, payerId: "mint", shares: [{ memberId: "act" }, { memberId: "mint" }, { memberId: "beam" }] });
    expect(byId(shares)).toEqual({ act: 33, mint: 34, beam: 33 });
  });

  it("equal: leftover goes to the first member when the payer does not share", () => {
    const shares = split({ mode: "equal", total: 100_000, payerId: "act", shares: [{ memberId: "beam" }, { memberId: "mint" }, { memberId: "ploy" }] });
    expect(byId(shares)).toEqual({ beam: 33_334, mint: 33_333, ploy: 33_333 });
  });

  it("shares: splits by weight and keeps the weight", () => {
    const shares = split({
      mode: "shares",
      total: 1000,
      payerId: "ploy",
      shares: [{ memberId: "act", weight: 2 }, { memberId: "mint", weight: 1 }, { memberId: "beam", weight: 3 }],
    });
    expect(shares).toEqual([
      { memberId: "act", amount: 334, weight: 2 },
      { memberId: "mint", amount: 166, weight: 1 },
      { memberId: "beam", amount: 500, weight: 3 },
    ]);
  });

  it("amount: accepts an exact sum", () => {
    const shares = split({
      mode: "amount",
      total: 480_000,
      payerId: "act",
      shares: [{ memberId: "act", amount: 120_000 }, { memberId: "mint", amount: 90_000 }, { memberId: "beam", amount: 135_000 }, { memberId: "ploy", amount: 135_000 }],
    });
    expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(480_000);
  });

  it("rejects shares that do not add up, and bad input", () => {
    const base = { payerId: "act", total: 1000 };
    expect(() => split({ ...base, mode: "amount", shares: [{ memberId: "act", amount: 500 }] })).toThrow(SplitError);
    expect(() => split({ ...base, mode: "amount", shares: [{ memberId: "act", amount: 1500 }, { memberId: "mint", amount: -500 }] })).toThrow(SplitError);
    expect(() => split({ ...base, mode: "amount", shares: [{ memberId: "act", amount: 999.5 }, { memberId: "mint", amount: 0.5 }] })).toThrow(SplitError);
    expect(() => split({ ...base, mode: "equal", shares: [] })).toThrow(SplitError);
    expect(() => split({ ...base, mode: "equal", shares: [{ memberId: "act" }, { memberId: "act" }] })).toThrow(SplitError);
    expect(() => split({ ...base, mode: "shares", shares: [{ memberId: "act", weight: 0 }] })).toThrow(SplitError);
    expect(() => split({ ...base, total: 0, mode: "equal", shares: [{ memberId: "act" }] })).toThrow(SplitError);
    expect(() => split({ ...base, total: 10.5, mode: "equal", shares: [{ memberId: "act" }] })).toThrow(SplitError);
  });
});

describe("Tokyo trip balances", () => {
  it("totals ฿30,350", () => {
    expect(totalSpent(tokyoExpenses)).toBe(3_035_000);
  });

  it("Net Balance: Act +14,050 · Mint −3,100 · Beam −5,800 · Ploy −5,150", () => {
    const rows = netBalances(all, tokyoExpenses);
    expect(Object.fromEntries(rows.map((r) => [r.memberId, r.net]))).toEqual({
      act: 1_405_000,
      mint: -310_000,
      beam: -580_000,
      ploy: -515_000,
    });
    expect(Object.fromEntries(rows.map((r) => [r.memberId, [r.paid, r.share]]))).toEqual({
      act: [2_200_000, 795_000],
      mint: [450_000, 760_000],
      beam: [105_000, 685_000],
      ploy: [280_000, 795_000],
    });
  });

  it("Outstanding: Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150 (sent does not count)", () => {
    expect(outstandingBalances(all, tokyoExpenses, tokyoSettlements)).toEqual({
      act: 1_095_000,
      mint: 0,
      beam: -580_000,
      ploy: -515_000,
    });
  });

  it("counts a Settlement once it is confirmed", () => {
    const confirmed = tokyoSettlements.map((s) => ({ ...s, status: "confirmed" as const }));
    expect(outstandingBalances(all, tokyoExpenses, confirmed)).toEqual({ act: 515_000, mint: 0, beam: 0, ploy: -515_000 });
  });

  it("rejects unknown members", () => {
    expect(() => netBalances(["act"], [{ payerId: "zed", amount: 1, shares: [] }])).toThrow();
  });
});

function apply(balances: Record<string, number>, transfers: SuggestedTransfer[]) {
  const next = { ...balances };
  for (const t of transfers) {
    next[t.fromId] = (next[t.fromId] ?? 0) + t.amount;
    next[t.toId] = (next[t.toId] ?? 0) - t.amount;
  }
  return next;
}

describe("suggestTransfers", () => {
  it("Tokyo: Beam → Act ฿5,800 and Ploy → Act ฿5,150", () => {
    const out = outstandingBalances(all, tokyoExpenses, tokyoSettlements);
    const transfers = suggestTransfers(out);
    expect(transfers).toEqual([
      { fromId: "beam", toId: "act", amount: 580_000 },
      { fromId: "ploy", toId: "act", amount: 515_000 },
    ]);
    expect(Object.values(apply(out, transfers)).every((v) => v === 0)).toBe(true);
  });

  it("prefers exact matches and stays within n − 1 transfers", () => {
    const balances = { x: 1000, y: 500, a: -700, b: -500, c: -300 };
    const transfers = suggestTransfers(balances);
    expect(transfers).toContainEqual({ fromId: "b", toId: "y", amount: 500 });
    expect(transfers.length).toBe(3);
    expect(Object.values(apply(balances, transfers)).every((v) => v === 0)).toBe(true);
  });

  it("returns nothing when settled and rejects unbalanced input", () => {
    expect(suggestTransfers({ act: 0, mint: 0 })).toEqual([]);
    expect(() => suggestTransfers({ act: 100, mint: -50 })).toThrow();
  });
});
