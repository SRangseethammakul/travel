import { describe, expect, it } from "vitest";
import { createSeed, TRIP_IDS } from "@/test/fixtures/seed";
import type { PlanItem } from "@/lib/api/types";
import { placeDays } from "./plan";
import {
  cityTabs,
  filterPlaces,
  groupPlaces,
  parsePlaceFilters,
  placeFiltersQuery,
  placeRowSub,
  placeRowWhen,
  tagOptions,
  tripCities,
  type PlaceRow,
} from "./places";

const seed = createSeed(new Date("2026-11-11T10:00:00Z"));
const tagNames = new Map(seed.tags.map((t) => [t.id, t.name]));

function rowsFor(tripId: string): PlaceRow[] {
  const trip = seed.trips.find((t) => t.id === tripId)!;
  const items: PlanItem[] = seed.planItems.filter((i) => i.tripId === tripId);
  const days = placeDays(items, trip);
  return seed.places
    .filter((p) => p.tripId === tripId)
    .map((p) => ({ id: p.id, name: p.name, type: p.type, city: p.city, area: p.area, tagIds: p.tagIds, days: days.get(p.id) ?? [] }));
}

const tokyo = rowsFor(TRIP_IDS.tokyo);
const japan = rowsFor(TRIP_IDS.japan);
const japanCities = tripCities(japan, seed.trips.find((t) => t.id === TRIP_IDS.japan)!.legs);

describe("parsePlaceFilters / placeFiltersQuery", () => {
  it("defaults: one city → all, area grouping, no tags", () => {
    const f = parsePlaceFilters({}, ["Tokyo"]);
    expect(f).toEqual({ city: "all", tags: [], unscheduled: false, group: "area" });
    expect(placeFiltersQuery(f, ["Tokyo"])).toBe("");
  });

  it("multi-city defaults to the first City Leg; city=all and city=kyoto are kept", () => {
    expect(japanCities).toEqual(["Tokyo", "Kyoto", "Osaka"]);
    expect(parsePlaceFilters({}, japanCities).city).toBe("tokyo");
    expect(parsePlaceFilters({ city: "all" }, japanCities).city).toBe("all");
    expect(parsePlaceFilters({ city: "Kyoto" }, japanCities).city).toBe("kyoto");
    expect(parsePlaceFilters({ city: "paris" }, japanCities).city).toBe("tokyo");
  });

  it("round-trips the agreed URL shape", () => {
    const f = parsePlaceFilters({ group: "type", tags: "a,b,a", unscheduled: "1", city: "kyoto" }, japanCities);
    expect(f).toEqual({ city: "kyoto", tags: ["a", "b"], unscheduled: true, group: "type" });
    expect(placeFiltersQuery(f, japanCities)).toBe("?city=kyoto&group=type&tags=a,b&unscheduled=1");
  });
});

describe("Tokyo trip (Places mockup)", () => {
  const all = parsePlaceFilters({}, ["Tokyo"]);

  it("groups 12 places into 5 areas + ไม่ระบุย่าน with planned counts", () => {
    const groups = groupPlaces(filterPlaces(tokyo, all), "area", false);
    expect(groups.map((g) => [g.title, g.count, g.planned])).toEqual([
      ["Shinjuku", 4, 3],
      ["Asakusa", 3, 2],
      ["Akihabara", 2, 1],
      ["Shibuya", 1, 1],
      ["Tokyo Station", 1, 1],
      ["ไม่ระบุย่าน", 1, 1],
    ]);
    expect(groups.at(-1)?.noArea).toBe(true);
  });

  it("groups by type and swaps the row subtitle", () => {
    const groups = groupPlaces(tokyo, "type", false);
    expect(groups.map((g) => g.title)).toEqual(["ที่พัก", "ที่กิน", "น่าสนใจ", "ที่เที่ยว", "เดินทาง"]);
    expect(placeRowSub(tokyo[0], "type", false)).toBe("Shinjuku");
    expect(placeRowSub(tokyo[0], "area", false)).toBe("ที่พัก");
  });

  it("filters ยังไม่จัดวัน", () => {
    expect(filterPlaces(tokyo, { ...all, unscheduled: true }).map((r) => r.id)).toEqual(["t-omoide", "t-tempura", "t-cafe"]);
  });

  it("matches any of several tags", () => {
    const f = { ...all, tags: ["tag-booking", "tag-ramen"] };
    expect(filterPlaces(tokyo, f).map((r) => r.id)).toEqual(["t-ramen", "t-yakiniku", "t-tempura"]);
    expect(filterPlaces(tokyo, { ...f, unscheduled: true }).map((r) => r.id)).toEqual(["t-tempura"]);
  });

  it("searches name, area and tag name", () => {
    expect(filterPlaces(tokyo, all, tagNames, "asakusa")).toHaveLength(3);
    expect(filterPlaces(tokyo, all, tagNames, "ต้องจอง").map((r) => r.id)).toEqual(["t-yakiniku", "t-tempura"]);
    expect(filterPlaces(tokyo, all, tagNames, "skytree").map((r) => r.id)).toEqual(["t-skytree"]);
  });

  it("orders tag chips by use", () => {
    const opts = tagOptions(tokyo, tagNames);
    expect(opts[0]).toEqual({ id: "tag-booking", name: "ต้องจอง", count: 2 });
    expect(opts).toHaveLength(10);
  });

  it("has no city tabs with one city", () => {
    expect(cityTabs(tokyo, ["Tokyo"])).toEqual([]);
  });
});

describe("Japan trip (PlacesJP mockup)", () => {
  it("shows city tabs with counts", () => {
    expect(cityTabs(japan, japanCities).map((t) => `${t.label} ${t.count}`)).toEqual(["ทั้งหมด 16", "Tokyo 9", "Kyoto 3", "Osaka 4"]);
  });

  it("filters by city and groups Kyoto areas", () => {
    const f = parsePlaceFilters({ city: "kyoto" }, japanCities);
    const groups = groupPlaces(filterPlaces(japan, f), "area", false);
    expect(groups.map((g) => [g.title, g.count, g.planned, g.noArea])).toEqual([
      ["Gion", 1, 0, false],
      ["Fushimi", 1, 1, false],
      ["ไม่ระบุย่าน", 1, 0, true],
    ]);
  });

  it("prefixes the city when all cities are shown", () => {
    const f = parsePlaceFilters({ city: "all" }, japanCities);
    const groups = groupPlaces(filterPlaces(japan, f), "area", true);
    expect(groups.map((g) => g.title).slice(0, 2)).toEqual(["Tokyo › Shinjuku", "Tokyo › Akihabara"]);
    expect(groups.some((g) => g.title === "Kyoto › ไม่ระบุย่าน")).toBe(true);
    expect(placeRowSub(japan[0], "type", true)).toBe("Tokyo › Shinjuku");
  });

  it("offers only tags used in the selected city", () => {
    const osaka = filterPlaces(japan, parsePlaceFilters({ city: "osaka" }, japanCities));
    expect(tagOptions(osaka, tagNames).map((t) => t.name)).toEqual(["สตรีทฟู้ด", "ปิ้งย่าง", "ต้องจอง", "ราเมง"]);
  });
});

describe("placeRowWhen", () => {
  it("shows the time when the Place is on one day and that visit is timed", () => {
    expect(placeRowWhen({ days: [2], time: "19:00" })).toBe("วัน 2 · 19:00");
  });
  it("lists days otherwise, and is null when Unscheduled", () => {
    expect(placeRowWhen({ days: [2] })).toBe("วัน 2");
    expect(placeRowWhen({ days: [1, 3], time: "09:00" })).toBe("วัน 1, 3");
    expect(placeRowWhen({ days: [] })).toBeNull();
  });
});
