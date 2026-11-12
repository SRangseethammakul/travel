import { describe, expect, it } from "vitest";
import { computeSplit, sharesMatchTotal, spreadRemaining } from "./split";

const all = ["act", "mint", "beam", "ploy"];
const byId = (r: ReturnType<typeof computeSplit>) =>
  Object.fromEntries(r.shares.map((s) => [s.memberId, s.amount]));

describe("computeSplit · equal", () => {
  it("splits the Tokyo hotel ฿22,000 four ways", () => {
    const r = computeSplit({ mode: "equal", total: 2200000, payerId: "act", participantIds: all });
    expect(byId(r)).toEqual({ act: 550000, mint: 550000, beam: 550000, ploy: 550000 });
    expect(r.balanced).toBe(true);
    expect(r.roundingRemainder).toBe(0);
  });

  it("splits the subway ticket ฿1,050 among three", () => {
    const r = computeSplit({ mode: "equal", total: 105000, payerId: "beam", participantIds: ["act", "beam", "ploy"] });
    expect(byId(r)).toEqual({ act: 35000, beam: 35000, ploy: 35000 });
  });

  it("gives the leftover satang to the payer", () => {
    const r = computeSplit({ mode: "equal", total: 100, payerId: "mint", participantIds: ["act", "mint", "beam"] });
    expect(byId(r)).toEqual({ act: 33, mint: 34, beam: 33 });
    expect(r.roundingRemainder).toBe(1);
    expect(r.remainderTo).toBe("mint");
    expect(r.allocated).toBe(100);
    expect(r.balanced).toBe(true);
  });

  it("gives the leftover to the first ticked member when the payer does not share", () => {
    const r = computeSplit({ mode: "equal", total: 100000, payerId: "act", participantIds: ["beam", "mint", "ploy"] });
    expect(byId(r)).toEqual({ beam: 33334, mint: 33333, ploy: 33333 });
    expect(r.remainderTo).toBe("beam");
    expect(r.balanced).toBe(true);
  });

  it("is not balanced with no participants or zero total", () => {
    expect(computeSplit({ mode: "equal", total: 1000, payerId: "act", participantIds: [] }).balanced).toBe(false);
    expect(computeSplit({ mode: "equal", total: 0, payerId: "act", participantIds: all }).balanced).toBe(false);
  });
});

describe("computeSplit · amount", () => {
  it("reports what is left (mockup ฿4,800 with 1,200/900/1,350/1,350 is exact)", () => {
    const r = computeSplit({
      mode: "amount",
      total: 480000,
      payerId: "act",
      participantIds: all,
      amounts: { act: 120000, mint: 90000, beam: 135000, ploy: 135000 },
    });
    expect(r.remaining).toBe(0);
    expect(r.balanced).toBe(true);
  });

  it("reports remaining and over-allocation", () => {
    const short = computeSplit({ mode: "amount", total: 480000, payerId: "act", participantIds: all, amounts: { act: 120000, mint: 90000 } });
    expect(short.remaining).toBe(270000);
    expect(short.balanced).toBe(false);

    const over = computeSplit({ mode: "amount", total: 100000, payerId: "act", participantIds: ["act", "mint"], amounts: { act: 80000, mint: 30000 } });
    expect(over.remaining).toBe(-10000);
    expect(over.balanced).toBe(false);
  });
});

describe("computeSplit · shares", () => {
  it("splits by parts (big room 2, small room 1)", () => {
    const r = computeSplit({ mode: "shares", total: 900000, payerId: "act", participantIds: ["act", "mint", "beam"], weights: { act: 2, mint: 1, beam: 1 } });
    expect(byId(r)).toEqual({ act: 450000, mint: 225000, beam: 225000 });
    expect(r.shares[0].weight).toBe(2);
    expect(r.balanced).toBe(true);
  });

  it("puts rounding leftovers on the payer, or the first participant", () => {
    const withPayer = computeSplit({ mode: "shares", total: 1000, payerId: "beam", participantIds: ["act", "mint", "beam"], weights: { act: 1, mint: 1, beam: 1 } });
    expect(byId(withPayer)).toEqual({ act: 333, mint: 333, beam: 334 });

    const noPayer = computeSplit({ mode: "shares", total: 1000, payerId: "ploy", participantIds: ["act", "mint", "beam"], weights: { act: 2, mint: 1, beam: 3 } });
    // 1000*2/6=333, 1000/6=166, 1000*3/6=500 → used 999, +1 to act
    expect(byId(noPayer)).toEqual({ act: 334, mint: 166, beam: 500 });
    expect(noPayer.allocated).toBe(1000);
  });

  it("rejects invalid weights", () => {
    expect(() => computeSplit({ mode: "shares", total: 100, payerId: "act", participantIds: ["act"], weights: { act: 0 } })).toThrow(RangeError);
  });
});

describe("spreadRemaining", () => {
  it("fills empty members first, remainder to the first of them", () => {
    const next = spreadRemaining(480000, all, { act: 120000, mint: 90000 });
    // 270000 left over beam + ploy
    expect(next).toEqual({ act: 120000, mint: 90000, beam: 135000, ploy: 135000 });
  });

  it("spreads over everyone when nobody is empty, leftover satang to the first", () => {
    const next = spreadRemaining(100100, ["act", "mint", "beam"], { act: 30000, mint: 30000, beam: 30000 });
    // diff 10100 → 3366 each, rest 2 to act
    expect(next).toEqual({ act: 33368, mint: 33366, beam: 33366 });
    expect(Object.values(next).reduce((a, b) => a + b, 0)).toBe(100100);
  });

  it("does nothing when nothing is left or it is over-allocated", () => {
    expect(spreadRemaining(1000, ["act"], { act: 1000 })).toEqual({ act: 1000 });
    expect(spreadRemaining(1000, ["act"], { act: 1500 })).toEqual({ act: 1500 });
  });
});

describe("sharesMatchTotal", () => {
  it("checks an exact sum", () => {
    expect(sharesMatchTotal(330000, [{ amount: 110000 }, { amount: 110000 }, { amount: 110000 }])).toBe(true);
    expect(sharesMatchTotal(330000, [{ amount: 110000 }, { amount: 110000 }])).toBe(false);
    expect(sharesMatchTotal(100, [{ amount: 150 }, { amount: -50 }])).toBe(false);
    expect(sharesMatchTotal(100, [])).toBe(false);
  });
});
