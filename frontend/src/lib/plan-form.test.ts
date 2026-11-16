import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/lib/api/types";
import { checkHop, checkLegs, checkTransitDraft, checkVisitDraft, checkVisitEdit, legStrip, nextFreeDays, pickSections, splitPlaceCode, transitDraftFromItem, transitPatchBody } from "./plan-form";

const trip = { startDate: "2026-12-12", endDate: "2026-12-15" };
const places = [
  { id: "hotel", name: "โรงแรม", city: "Tokyo", area: "Shinjuku" },
  { id: "ramen", name: "ราเมง", city: "Tokyo", area: "Shinjuku" },
  { id: "sensoji", name: "เซ็นโซจิ", city: "Tokyo", area: "Asakusa" },
  { id: "tempura", name: "เทมปุระ", city: "Tokyo", area: "Asakusa" },
  { id: "cafe", name: "คาเฟ่", city: "Tokyo", area: "Akihabara" },
  { id: "x", name: "ไม่มีย่าน", city: "Tokyo", area: null },
];
const visit = (id: string, day: number, placeId: string): PlanItem => ({ kind: "place", id, tripId: "t", day, time: null, placeId, note: "", createdBy: "act" });
const items = [visit("1", 1, "hotel"), visit("2", 2, "sensoji")];

describe("pickSections", () => {
  it("puts places in the day's areas first and hides places already on that day", () => {
    const s = pickSections(places, items, trip, 2);
    expect(s[0].key).toBe("near");
    expect(s[0].rows.map((r) => r.place.id)).toEqual(["tempura"]);
    expect(s[1].rows.map((r) => r.place.id)).toEqual(["cafe", "ramen", "hotel", "x"]);
    expect(s[1].rows.find((r) => r.place.id === "hotel")?.days).toEqual([1]);
  });
});

describe("checkVisitDraft", () => {
  it("needs a place and at least one day inside the trip", () => {
    expect(checkVisitDraft({ placeId: "cafe", days: [3, 2, 2], time: "15:00", note: "" }, ["cafe"], 4)).toEqual({ ok: true, days: [2, 3], time: "15:00", note: "" });
    expect(checkVisitDraft({ placeId: "cafe", days: [], time: "", note: "" }, ["cafe"], 4).ok).toBe(false);
    expect(checkVisitDraft({ placeId: "cafe", days: [5], time: "", note: "" }, ["cafe"], 4).ok).toBe(false);
    expect(checkVisitDraft({ placeId: "cafe", days: [1], time: "25:00", note: "" }, ["cafe"], 4).ok).toBe(false);
  });
});

describe("checkVisitEdit", () => {
  it("clears the time with an empty string and keeps day null for stays", () => {
    expect(checkVisitEdit({ day: 2, time: " 09:30 ", note: " ที่นี่ " }, 4)).toEqual({ ok: true, day: 2, time: "09:30", note: "ที่นี่" });
    expect(checkVisitEdit({ day: null, time: "", note: "" }, 4)).toEqual({ ok: true, day: null, time: null, note: "" });
  });
  it("rejects a day outside the trip, a bad time and a long note", () => {
    expect(checkVisitEdit({ day: 5, time: "", note: "" }, 4).ok).toBe(false);
    expect(checkVisitEdit({ day: 1, time: "24:00", note: "" }, 4).ok).toBe(false);
    expect(checkVisitEdit({ day: 1, time: "", note: "x".repeat(201) }, 4).ok).toBe(false);
  });
});

describe("checkHop", () => {
  it("accepts mode, optional minutes and note", () => {
    expect(checkHop({ mode: "train", minutes: "40", note: " JR " })).toEqual({ ok: true, hop: { mode: "train", minutes: 40, note: "JR" } });
    expect(checkHop({ mode: "walk", minutes: "", note: "" })).toEqual({ ok: true, hop: { mode: "walk" } });
    expect(checkHop({ mode: "fly", minutes: "", note: "" }).ok).toBe(false);
    expect(checkHop({ mode: "walk", minutes: "abc", note: "" }).ok).toBe(false);
  });
});

describe("transit", () => {
  it("splits airport codes", () => {
    expect(splitPlaceCode("สนามบินฮาเนดะ (HND)")).toEqual({ text: "สนามบินฮาเนดะ", code: "HND" });
    expect(splitPlaceCode("Kyoto Station")).toEqual({ text: "Kyoto Station" });
  });
  it("builds local date-times and checks the departure day", () => {
    const draft = { mode: "plane" as const, fromText: "สนามบินฮาเนดะ (HND)", toText: "สุวรรณภูมิ (BKK)", departDate: "2026-12-15", departTime: "18:00", arriveDate: "2026-12-15", arriveTime: "23:30", bookingRef: "", docIds: ["doc-flight"] };
    const r = checkTransitDraft(draft, trip, ["doc-flight"]);
    expect(r.ok && [r.departAt, r.arriveAt, r.fromCode, r.toCode]).toEqual(["2026-12-15T18:00", "2026-12-15T23:30", "HND", "BKK"]);
    expect(checkTransitDraft({ ...draft, departDate: "2026-12-20" }, trip, ["doc-flight"]).ok).toBe(false);
    expect(checkTransitDraft({ ...draft, docIds: ["other"] }, trip, ["doc-flight"]).ok).toBe(false);
  });
});

describe("transit edit", () => {
  const saved = {
    kind: "transit" as const, id: "tr", tripId: "t", mode: "plane" as const, fromCode: "HND", fromText: "สนามบินฮาเนดะ", toCode: "BKK", toText: "สุวรรณภูมิ",
    departAt: "2026-12-15T18:00", arriveAt: "2026-12-15T23:30", bookingRef: "ABC123", docIds: ["doc-flight"], expenseId: "e1", fromPlaceId: "hnd", createdBy: "act",
  };
  it("prefills the form from a saved Transit, code back inside the text", () => {
    expect(transitDraftFromItem(saved)).toEqual({
      mode: "plane", fromText: "สนามบินฮาเนดะ (HND)", toText: "สุวรรณภูมิ (BKK)", departDate: "2026-12-15", departTime: "18:00", arriveDate: "2026-12-15", arriveTime: "23:30",
      bookingRef: "ABC123", seatInfo: "", docIds: ["doc-flight"], fromPlaceId: "hnd",
    });
  });
  it("round-trips unchanged and sends null for cleared optional fields, never expenseId", () => {
    const draft = transitDraftFromItem(saved);
    const same = checkTransitDraft(draft, trip, ["doc-flight"]);
    expect(same.ok && transitPatchBody(same, draft)).toEqual({
      mode: "plane", fromText: "สนามบินฮาเนดะ", toText: "สุวรรณภูมิ", fromCode: "HND", toCode: "BKK", departAt: "2026-12-15T18:00", arriveAt: "2026-12-15T23:30",
      bookingRef: "ABC123", seatInfo: null, docIds: ["doc-flight"], fromPlaceId: "hnd", toPlaceId: null,
    });
    const cleared = { ...draft, fromText: "ฮาเนดะ", bookingRef: "", docIds: [], fromPlaceId: undefined, seatInfo: "12A", departTime: "19:15" };
    const r = checkTransitDraft(cleared, trip, []);
    const body = r.ok ? transitPatchBody(r, cleared) : null;
    expect(body).toMatchObject({ fromCode: null, bookingRef: null, docIds: [], fromPlaceId: null, seatInfo: "12A", departAt: "2026-12-15T19:15" });
    expect(body).not.toHaveProperty("expenseId");
  });
});

describe("City Legs", () => {
  const jp = { startDate: "2027-03-20", endDate: "2027-03-28" };
  const legs = [
    { city: "Kyoto", from: 5, to: 6 },
    { city: "Tokyo", from: 1, to: 4 },
  ];
  it("sorts legs and rejects overlaps and out-of-trip days", () => {
    expect(checkLegs(legs, jp)).toEqual({ ok: true, legs: [legs[1], legs[0]] });
    expect(checkLegs([...legs, { city: "Osaka", from: 6, to: 9 }], jp).ok).toBe(false);
    expect(checkLegs([{ city: "Osaka", from: 7, to: 10 }], jp).ok).toBe(false);
  });
  it("maps days to cities and finds the next free range", () => {
    expect(legStrip(legs, 9)).toEqual(["Tokyo", "Tokyo", "Tokyo", "Tokyo", "Kyoto", "Kyoto", null, null, null]);
    expect(nextFreeDays(legs, 9)).toEqual({ from: 7, to: 9 });
    expect(nextFreeDays([{ city: "Tokyo", from: 1, to: 9 }], 9)).toBeNull();
  });
});
