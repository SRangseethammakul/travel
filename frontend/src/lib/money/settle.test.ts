import { describe, expect, it } from "vitest";
import { outstandingBalances } from "./balance";
import { tokyoExpenses, tokyoMembers, tokyoSettlements } from "./fixtures";
import { suggestTransfers, type SuggestedTransfer } from "./settle";

function applyTransfers(balances: Record<string, number>, transfers: SuggestedTransfer[]) {
  const next = { ...balances };
  for (const t of transfers) {
    next[t.fromId] += t.amount;
    next[t.toId] -= t.amount;
  }
  return next;
}

describe("suggestTransfers", () => {
  it("settles the Tokyo trip from Outstanding with two transfers to Act", () => {
    const out = outstandingBalances(tokyoMembers, tokyoExpenses, tokyoSettlements);
    const transfers = suggestTransfers(out);
    expect(transfers).toEqual([
      { fromId: "beam", toId: "act", amount: 580000 },
      { fromId: "ploy", toId: "act", amount: 515000 },
    ]);
    expect(Object.values(applyTransfers(out, transfers)).every((v) => v === 0)).toBe(true);
  });

  it("settles the Tokyo Net Balance (no settlements) in at most n − 1 transfers", () => {
    const out = outstandingBalances(tokyoMembers, tokyoExpenses, []);
    const transfers = suggestTransfers(out);
    expect(transfers.length).toBeLessThanOrEqual(tokyoMembers.length - 1);
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(1405000);
    expect(Object.values(applyTransfers(out, transfers)).every((v) => v === 0)).toBe(true);
  });

  it("prefers exact matches to save transfers", () => {
    // Greedy alone would do a→x 700, b→x 300, b→y 200, c→y 300 (4). Exact pairs need 3.
    const balances = { x: 1000, y: 500, a: -700, b: -500, c: -300 };
    const transfers = suggestTransfers(balances);
    expect(transfers).toContainEqual({ fromId: "b", toId: "y", amount: 500 });
    expect(transfers.length).toBe(3);
    expect(Object.values(applyTransfers(balances, transfers)).every((v) => v === 0)).toBe(true);
  });

  it("keeps the n − 1 bound and zero sum on many random cases", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(rand() * 7);
      const values = Array.from({ length: n - 1 }, () => Math.floor(rand() * 2000000) - 1000000);
      values.push(-values.reduce((a, b) => a + b, 0));
      const balances = Object.fromEntries(values.map((v, i) => [`m${i}`, v]));
      const transfers = suggestTransfers(balances);
      expect(transfers.length).toBeLessThanOrEqual(n - 1);
      expect(transfers.every((t) => t.amount > 0)).toBe(true);
      expect(Object.values(applyTransfers(balances, transfers)).every((v) => v === 0)).toBe(true);
    }
  });

  it("returns nothing when everyone is settled and rejects unbalanced input", () => {
    expect(suggestTransfers({ act: 0, mint: 0 })).toEqual([]);
    expect(() => suggestTransfers({ act: 100, mint: -50 })).toThrow();
  });
});
