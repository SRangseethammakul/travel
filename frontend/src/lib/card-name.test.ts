import { describe, expect, it } from "vitest";
import { cardNameChips, checkCardName, usedCardNames } from "./card-name";

describe("checkCardName", () => {
  it("trims, and treats blank as absent", () => {
    expect(checkCardName("  UOB PRVI ")).toEqual({ ok: true, cardName: "UOB PRVI" });
    expect(checkCardName("   ")).toEqual({ ok: true });
    expect(checkCardName(undefined)).toEqual({ ok: true });
  });
  it("allows 30 characters but not 31", () => {
    expect(checkCardName("x".repeat(30)).ok).toBe(true);
    expect(checkCardName("x".repeat(31)).ok).toBe(false);
  });
});

describe("usedCardNames", () => {
  it("merges group and personal lists, case-insensitively distinct, in first-seen order", () => {
    expect(usedCardNames([{ cardName: "UOB PRVI" }, {}, { cardName: " KBank " }], [{ cardName: "kbank" }, { cardName: "Wise" }])).toEqual([
      "UOB PRVI",
      "KBank",
      "Wise",
    ]);
  });
});

describe("cardNameChips", () => {
  it("lists common banks when nothing was used", () => {
    expect(cardNameChips([])).toEqual(["KBank", "SCB", "KTC", "UOB", "กรุงศรี", "BBL", "ttb"]);
  });
  it("puts used names first and drops duplicate banks regardless of case", () => {
    expect(cardNameChips(["UOB PRVI", "scb", "Wise"])).toEqual(["UOB PRVI", "scb", "Wise", "KBank", "KTC", "UOB", "กรุงศรี", "BBL", "ttb"]);
  });
});
