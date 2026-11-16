import { describe, expect, it } from "vitest";
import {
  areasInCity,
  checkPlaceDraft,
  defaultStayDates,
  groupTags,
  isNewTagName,
  legHint,
  resolveTagNames,
  stayExpenseSync,
  stayPhase,
  stayPlanSync,
  stayTripDays,
  tagSuggestions,
  tagUsage,
  type PlaceDraft,
} from "./place-form";

const draft: PlaceDraft = {
  name: "  ร้านซูชิสายพาน ",
  mapUrl: "",
  type: "food",
  city: "Tokyo",
  area: "Shibuya",
  tagIds: ["tag-ramen"],
  newTagNames: ["#ซูชิ", "ซูชิ", " "],
  note: "",
};

describe("checkPlaceDraft", () => {
  it("cleans the name, area and new tags", () => {
    const r = checkPlaceDraft(draft);
    expect(r).toEqual({ ok: true, name: "ร้านซูชิสายพาน", type: "food", city: "Tokyo", area: "Shibuya", note: "", tagIds: ["tag-ramen"], newTagNames: ["ซูชิ"] });
  });
  it("treats an empty area as ไม่ระบุย่าน", () => {
    const r = checkPlaceDraft({ ...draft, area: " " });
    expect(r.ok && r.area).toBeNull();
  });
  it("rejects a missing name, missing city and non-http links", () => {
    expect(checkPlaceDraft({ ...draft, name: "" }).ok).toBe(false);
    expect(checkPlaceDraft({ ...draft, city: "" }).ok).toBe(false);
    expect(checkPlaceDraft({ ...draft, mapUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(checkPlaceDraft({ ...draft, mapUrl: "https://maps.app.goo.gl/abc" }).ok).toBe(true);
  });
});

const myTags = [
  { id: "tag-ramen", name: "ราเมง", ownerId: "act", group: "อาหาร" },
  { id: "tag-late", name: "เปิดดึก", ownerId: "act", group: null },
];
const tripTags = [...myTags, { id: "tag-soba", name: "โซบะ", ownerId: "n", group: null }];

describe("tags", () => {
  it("reuses my tag, then another member's tag, before creating one", () => {
    expect(resolveTagNames(["ราเมง", "โซบะ", "ซูชิ"], myTags, tripTags)).toEqual({ ids: ["tag-ramen", "tag-soba"], create: ["ซูชิ"] });
  });
  it("suggests my tags first, then other tags in the trip", () => {
    const s = tagSuggestions("act", myTags, tripTags, ["tag-ramen"], "");
    expect(s.mine.map((t) => t.id)).toEqual(["tag-late"]);
    expect(s.others.map((t) => t.id)).toEqual(["tag-soba"]);
    expect(tagSuggestions("act", myTags, tripTags, [], "โซ").mine).toEqual([]);
  });
  it("knows when the typed text is a new tag", () => {
    expect(isNewTagName("ซูชิ", tripTags, [])).toBe(true);
    expect(isNewTagName("#ราเมง", tripTags, [])).toBe(false);
    expect(isNewTagName("", tripTags, [])).toBe(false);
  });
  it("groups tags with ไม่มีกลุ่ม last and counts usage", () => {
    expect(groupTags([myTags[1], myTags[0]]).map((g) => g.group)).toEqual(["อาหาร", null]);
    expect(tagUsage([{ tagIds: ["a", "b"] }, { tagIds: ["a"] }]).get("a")).toBe(2);
  });
});

describe("areas and legs", () => {
  it("lists a city's areas with counts, no-area last", () => {
    const places = [
      { city: "Tokyo", area: null },
      { city: "Tokyo", area: "Shinjuku" },
      { city: "Kyoto", area: "Gion" },
      { city: "Tokyo", area: "Shinjuku" },
    ];
    expect(areasInCity(places, "Tokyo")).toEqual([
      { area: "Shinjuku", count: 2 },
      { area: null, count: 1 },
    ]);
  });
  it("describes the City Leg", () => {
    expect(legHint([{ city: "Tokyo", from: 1, to: 4 }], "Tokyo")).toBe("Tokyo วันที่ 1–4");
    expect(legHint([{ city: "Kyoto", from: 5, to: 5 }], "Kyoto")).toBe("Kyoto วันที่ 5");
    expect(legHint(undefined, "Tokyo")).toBeNull();
  });
});

describe("stay (hotel) fields", () => {
  const base: PlaceDraft = { name: "Hotel", mapUrl: "", type: "stay", city: "หัวหิน", area: "", tagIds: [], newTagNames: [], note: "" };
  const trip = { startDate: "2026-12-10", endDate: "2026-12-12" };

  it("builds stay from baht text and drops empty optionals", () => {
    const r = checkPlaceDraft({ ...base, checkIn: "2026-12-10", checkOut: "2026-12-12", price: "5,600", bookingRef: " AB1 ", address: "" });
    expect(r).toMatchObject({ ok: true, stay: { checkIn: "2026-12-10", checkOut: "2026-12-12", price: 560000, bookingRef: "AB1" } });
    expect(r.ok && r.stay && "address" in r.stay).toBe(false);
  });
  it("needs both dates, checkout after checkin", () => {
    expect(checkPlaceDraft({ ...base, checkIn: "2026-12-10" })).toMatchObject({ ok: false });
    expect(checkPlaceDraft({ ...base, checkIn: "2026-12-11", checkOut: "2026-12-11" })).toMatchObject({ ok: false });
  });
  it("no dates is a plain place; other types ignore stay fields", () => {
    expect(checkPlaceDraft(base)).toMatchObject({ ok: true });
    const r = checkPlaceDraft({ ...base, type: "food", checkIn: "2026-12-10", checkOut: "2026-12-11" });
    expect(r.ok && "stay" in r).toBe(false);
  });
  it("stayTripDays covers check-in through check-out, clamped", () => {
    expect(stayTripDays({ checkIn: "2026-12-10", checkOut: "2026-12-12" }, trip)).toEqual([1, 2, 3]);
    expect(stayTripDays({ checkIn: "2026-12-11", checkOut: "2026-12-12" }, trip)).toEqual([2, 3]);
  });
  it("stayPhase", () => {
    const s = { checkIn: "2026-12-10", checkOut: "2026-12-12" };
    expect([stayPhase(s, "2026-12-10"), stayPhase(s, "2026-12-11"), stayPhase(s, "2026-12-12"), stayPhase(s, "2026-12-13")]).toEqual(["in", "night", "out", null]);
  });
});

describe("type is never defaulted", () => {
  const base: PlaceDraft = { name: "โรงแรมซีบรีส", mapUrl: "", type: "", city: "หัวหิน", area: "", tagIds: [], newTagNames: [], note: "" };
  it("asks for a type and names the choices", () => {
    const r = checkPlaceDraft(base);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ที่พัก");
  });
  it("accepts a chosen type", () => {
    expect(checkPlaceDraft({ ...base, type: "stay" }).ok).toBe(true);
  });
});

describe("stayPlanSync (Hua Hin 18–20 Dec, hotel 1 shortened to check out on the 19th)", () => {
  const trip = { startDate: "2026-12-18", endDate: "2026-12-20" };
  const visit = (id: string, day: number, extra: { time?: string | null; note?: string } = {}) => ({ id, day, time: extra.time ?? null, note: extra.note ?? "" });
  const all = [visit("a1", 1), visit("a2", 2), visit("a3", 3)];

  it("removes the untouched visit on the day that is no longer part of the stay", () => {
    const r = stayPlanSync(all, { checkIn: "2026-12-18", checkOut: "2026-12-20" }, { checkIn: "2026-12-18", checkOut: "2026-12-19" }, trip);
    expect(r).toEqual({ addDays: [], removeIds: ["a3"] });
  });
  it("keeps a visit the user timed or annotated", () => {
    const v = [visit("a1", 1), visit("a2", 2), visit("a3", 3, { time: "10:00" })];
    expect(stayPlanSync(v, { checkIn: "2026-12-18", checkOut: "2026-12-20" }, { checkIn: "2026-12-18", checkOut: "2026-12-19" }, trip).removeIds).toEqual([]);
    const n = [visit("a1", 1), visit("a2", 2), visit("a3", 3, { note: "ขอห้องวิว" })];
    expect(stayPlanSync(n, { checkIn: "2026-12-18", checkOut: "2026-12-20" }, { checkIn: "2026-12-18", checkOut: "2026-12-19" }, trip).removeIds).toEqual([]);
  });
  it("adds days when the stay is extended and never touches days outside the old stay", () => {
    const r = stayPlanSync([visit("a1", 1)], { checkIn: "2026-12-18", checkOut: "2026-12-19" }, { checkIn: "2026-12-18", checkOut: "2026-12-20" }, trip);
    expect(r).toEqual({ addDays: [2, 3], removeIds: [] });
    const manual = [visit("m3", 3)]; // placed by hand on day 3, old stay ended on day 2
    expect(stayPlanSync(manual, { checkIn: "2026-12-18", checkOut: "2026-12-19" }, { checkIn: "2026-12-18", checkOut: "2026-12-19" }, trip).removeIds).toEqual([]);
  });
  it("moving the stay removes the old days and adds the new ones", () => {
    const r = stayPlanSync([visit("a1", 1), visit("a2", 2)], { checkIn: "2026-12-18", checkOut: "2026-12-19" }, { checkIn: "2026-12-19", checkOut: "2026-12-20" }, trip);
    expect(r).toEqual({ addDays: [3], removeIds: ["a1"] });
  });
  it("removing the stay clears the untouched visits of its days", () => {
    expect(stayPlanSync(all, { checkIn: "2026-12-18", checkOut: "2026-12-20" }, null, trip)).toEqual({ addDays: [], removeIds: ["a1", "a2", "a3"] });
  });
});

describe("defaultStayDates", () => {
  const trip = { startDate: "2026-11-29", endDate: "2026-12-01" };
  it("checks in on the day the user came from and out the next day", () => {
    expect(defaultStayDates(trip, 1)).toEqual({ checkIn: "2026-11-29", checkOut: "2026-11-30" });
    expect(defaultStayDates(trip, 2)).toEqual({ checkIn: "2026-11-30", checkOut: "2026-12-01" });
  });
  it("leaves check-out empty on the last day, and everything empty without a valid day", () => {
    expect(defaultStayDates(trip, 3)).toEqual({ checkIn: "2026-12-01", checkOut: "" });
    expect(defaultStayDates(trip, 9)).toEqual({ checkIn: "", checkOut: "" });
    expect(defaultStayDates(trip, undefined)).toEqual({ checkIn: "", checkOut: "" });
  });
});

describe("stayExpenseSync", () => {
  const equal = { id: "e1", amount: 560000, splitMode: "equal" as const, canEdit: true };
  it("asks to update an equal-split cost when the price changed", () => {
    expect(stayExpenseSync({ price: 560000 }, { price: 280000 }, equal)).toBe("update");
  });
  it("sends custom / ratio splits to the expense edit page, and others' expenses to a note", () => {
    expect(stayExpenseSync({ price: 560000 }, { price: 280000 }, { ...equal, splitMode: "amount" })).toBe("manual");
    expect(stayExpenseSync({ price: 560000 }, { price: 280000 }, { ...equal, canEdit: false })).toBe("locked");
  });
  it("asks nothing when unlinked, price unchanged, cleared, or already equal to the cost", () => {
    expect(stayExpenseSync({ price: 560000 }, { price: 280000 }, null)).toBeNull();
    expect(stayExpenseSync({ price: 560000 }, { price: 560000 }, equal)).toBeNull();
    expect(stayExpenseSync({ price: 560000 }, {}, equal)).toBeNull();
    expect(stayExpenseSync({ price: 300000 }, { price: 560000 }, equal)).toBeNull();
  });
});
