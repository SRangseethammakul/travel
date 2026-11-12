import { describe, expect, it } from "vitest";
import { MINUS, baht, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats whole baht without decimals", () => {
    expect(formatMoney(480000)).toBe("฿4,800");
    expect(formatMoney(3035000)).toBe("฿30,350");
    expect(formatMoney(0)).toBe("฿0");
  });

  it("shows two decimals only when there are satang", () => {
    expect(formatMoney(121250)).toBe("฿1,212.50");
    expect(formatMoney(5)).toBe("฿0.05");
    expect(formatMoney(100000001)).toBe("฿1,000,000.01");
  });

  it("handles signs", () => {
    expect(formatMoney(-310000)).toBe(`${MINUS}฿3,100`);
    expect(formatMoney(1405000, { sign: "always" })).toBe("+฿14,050");
    expect(formatMoney(-515000, { sign: "always" })).toBe(`${MINUS}฿5,150`);
    expect(formatMoney(0, { sign: "always" })).toBe("฿0");
    expect(formatMoney(-580000, { sign: "never" })).toBe("฿5,800");
  });

  it("rejects non-integer satang", () => {
    expect(() => formatMoney(12.5)).toThrow(TypeError);
  });

  it("baht() converts to satang", () => {
    expect(baht(30350)).toBe(3035000);
    expect(baht(1212.5)).toBe(121250);
  });
});
