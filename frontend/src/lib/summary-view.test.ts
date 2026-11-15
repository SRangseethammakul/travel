import { describe, expect, it } from "vitest";
import { balanceLabel } from "./summary-view";

describe("balanceLabel", () => {
  it("uses the mockup words while nothing is confirmed (Tokyo: Beam, Ploy)", () => {
    expect(balanceLabel(-580_000, -580_000)).toEqual({ text: "ต้องจ่ายเพิ่ม", tone: "pay" });
    expect(balanceLabel(-515_000, -515_000)).toEqual({ text: "ต้องจ่ายเพิ่ม", tone: "pay" });
  });
  it("says what is left once part is confirmed (Tokyo: Act +14,050 net, +10,950 outstanding)", () => {
    expect(balanceLabel(1_405_000, 1_095_000)).toEqual({ text: "รอรับคืนอีก ฿10,950", tone: "receive" });
    expect(balanceLabel(-65_000, -25_000)).toEqual({ text: "ค้างจ่ายอีก ฿250", tone: "pay" });
  });
  it("never says pay more once Outstanding is 0 (APP-8; Tokyo: Mint)", () => {
    expect(balanceLabel(-310_000, 0)).toEqual({ text: "เคลียร์แล้ว", tone: "neutral" });
    expect(balanceLabel(-65_000, 0)).toEqual({ text: "เคลียร์แล้ว", tone: "neutral" });
    expect(balanceLabel(65_000, 0)).toEqual({ text: "เคลียร์แล้ว", tone: "neutral" });
  });
  it("keeps พอดี for a Net Balance of 0", () => {
    expect(balanceLabel(0, 0)).toEqual({ text: "พอดี", tone: "neutral" });
  });
});
