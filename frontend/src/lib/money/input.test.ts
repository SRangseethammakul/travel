import { describe, expect, it } from "vitest";
import { formatBahtInput, parseBahtInput, satangToInput } from "./input";

describe("formatBahtInput", () => {
  it("adds thousands separators and keeps up to 2 decimals", () => {
    expect(formatBahtInput("4800")).toBe("4,800");
    expect(formatBahtInput("1212.5")).toBe("1,212.5");
    expect(formatBahtInput("12.345")).toBe("12.34");
    expect(formatBahtInput("0012")).toBe("12");
    expect(formatBahtInput(".5")).toBe("0.5");
    expect(formatBahtInput("abc")).toBe("");
    expect(formatBahtInput("30,350")).toBe("30,350");
  });
});

describe("parseBahtInput", () => {
  it("turns typed baht into satang", () => {
    expect(parseBahtInput("4,800")).toBe(480_000);
    expect(parseBahtInput("1,212.50")).toBe(121_250);
    expect(parseBahtInput("1212.5")).toBe(121_250);
    expect(parseBahtInput("0.01")).toBe(1);
    expect(parseBahtInput("")).toBe(0);
  });
  it("rejects invalid text", () => {
    expect(parseBahtInput("12.345")).toBeNull();
    expect(parseBahtInput("abc")).toBeNull();
    expect(parseBahtInput(".")).toBeNull();
    expect(parseBahtInput("-5")).toBeNull();
  });
});

describe("satangToInput", () => {
  it("round-trips with parseBahtInput", () => {
    for (const v of [480_000, 121_250, 1, 3_035_000]) expect(parseBahtInput(satangToInput(v))).toBe(v);
    expect(satangToInput(0)).toBe("");
    expect(satangToInput(121_250)).toBe("1,212.50");
  });
});
