import { describe, expect, it } from "vitest";
import { netBalances, outstandingBalances, totalSpent } from "./balance";
import { tokyoExpenses, tokyoMembers, tokyoSettlements } from "./fixtures";

describe("Tokyo trip balances", () => {
  it("totals ฿30,350", () => {
    expect(totalSpent(tokyoExpenses)).toBe(3035000);
  });

  it("computes Net Balance: Act +14,050 · Mint −3,100 · Beam −5,800 · Ploy −5,150", () => {
    const rows = netBalances(tokyoMembers, tokyoExpenses);
    expect(Object.fromEntries(rows.map((r) => [r.memberId, r.net]))).toEqual({
      act: 1405000,
      mint: -310000,
      beam: -580000,
      ploy: -515000,
    });
    expect(rows.reduce((s, r) => s + r.net, 0)).toBe(0);
  });

  it("matches the paid / share columns in SPEC", () => {
    const rows = Object.fromEntries(netBalances(tokyoMembers, tokyoExpenses).map((r) => [r.memberId, r]));
    expect([rows.act.paid, rows.act.share]).toEqual([2200000, 795000]);
    expect([rows.mint.paid, rows.mint.share]).toEqual([450000, 760000]);
    expect([rows.beam.paid, rows.beam.share]).toEqual([105000, 685000]);
    expect([rows.ploy.paid, rows.ploy.share]).toEqual([280000, 795000]);
  });

  it("computes Outstanding: Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150 (sent does not count)", () => {
    const out = outstandingBalances(tokyoMembers, tokyoExpenses, tokyoSettlements);
    expect(out).toEqual({ act: 1095000, mint: 0, beam: -580000, ploy: -515000 });
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("counts a settlement once it is confirmed", () => {
    const out = outstandingBalances(tokyoMembers, tokyoExpenses, [
      ...tokyoSettlements.filter((s) => s.fromId !== "beam"),
      { fromId: "beam", toId: "act", amount: 580000, status: "confirmed" },
    ]);
    expect(out).toEqual({ act: 515000, mint: 0, beam: 0, ploy: -515000 });
  });

  it("rejects unknown members", () => {
    expect(() => netBalances(["act"], [{ payerId: "zed", amount: 1, shares: [] }])).toThrow();
  });
});
