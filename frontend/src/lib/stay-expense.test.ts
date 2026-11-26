import { describe, expect, it } from "vitest";
import { equalShare, stayExpenseDraft, stayExpenseSavedText, stayExpenseSplitText } from "./stay-expense";

const trip = { startDate: "2026-12-12", endDate: "2026-12-15" };
const members = ["act", "mint", "beam", "ploy"];

describe("stayExpenseDraft", () => {
  it("prefills a stay expense paid by me and split equally between everyone", () => {
    const d = stayExpenseDraft({ placeName: "Shinjuku Granbell", stay: { checkIn: "2026-12-13", price: 540_000 }, trip, payerId: "act", memberIds: members });
    expect(d).toMatchObject({
      title: "ที่พัก Shinjuku Granbell",
      category: "stay",
      payerId: "act",
      date: "2026-12-13",
      amount: 540_000,
      splitMode: "equal",
      participantIds: members,
    });
  });

  it("clamps the date into the trip", () => {
    const d = stayExpenseDraft({ placeName: "X", stay: { checkIn: "2026-12-01", price: 100 }, trip, payerId: "act", memberIds: members });
    expect(d.date).toBe("2026-12-12");
  });
});

describe("equalShare", () => {
  it("splits evenly", () => {
    expect(equalShare(540_000, 4)).toEqual({ each: 135_000, approx: false });
  });
  it("flags a satang remainder and uses the smaller share", () => {
    expect(equalShare(10_001, 2)).toEqual({ each: 5_000, approx: true });
  });
  it("one member pays all", () => {
    expect(equalShare(540_000, 1)).toEqual({ each: 540_000, approx: false });
  });
});

describe("wording", () => {
  it("states the split before saving", () => {
    expect(stayExpenseSplitText(540_000, 4)).toBe("หาร 4 คน คนละ ฿1,350");
    expect(stayExpenseSplitText(10_001, 2)).toBe("หาร 2 คน คนละ ~฿50");
  });
  it("toast text", () => {
    expect(stayExpenseSavedText("บันทึกที่พักและค่าใช้จ่าย", 540_000, 4)).toBe("บันทึกที่พักและค่าใช้จ่าย ฿5,400 แล้ว (หาร 4 คน คนละ ฿1,350)");
  });
});
