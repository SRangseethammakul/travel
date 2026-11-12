import { describe, expect, it } from "vitest";
import {
  areasInCity,
  checkPlaceDraft,
  groupTags,
  isNewTagName,
  legHint,
  resolveTagNames,
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
    expect(r).toEqual({ ok: true, name: "ร้านซูชิสายพาน", city: "Tokyo", area: "Shibuya", note: "", tagIds: ["tag-ramen"], newTagNames: ["ซูชิ"] });
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
