import { describe, expect, it } from "vitest";
import { createSeed, TRIP_IDS } from "@/test/fixtures/seed";
import { formatDuration } from "@/lib/labels";
import type { PlanItem, TransitPlanItem } from "@/lib/api/types";
import { formatVisitLine, placeVisits, stayTransitWarnings, tripChecks, nightsLodging, arrivalsOnDay, dayAreasLabel, dayCardCaption, hopText, itemsByDay, legCity, placeDays, resolveDay, unscheduledPlaces } from "./plan";

const seed = createSeed(new Date("2026-11-11T10:00:00Z"));
const trip = (id: string) => seed.trips.find((t) => t.id === id)!;
const sorted = (tripId: string): PlanItem[] => {
  const t = trip(tripId);
  const time = (i: PlanItem) => (i.kind === "transit" ? i.departAt.slice(11, 16) : (i.time ?? "99:99"));
  const day = (i: PlanItem) => (i.kind === "place" ? i.day : Number(i.departAt.slice(8, 10)) - Number(t.startDate.slice(8, 10)) + 1);
  return seed.planItems.filter((i) => i.tripId === tripId).sort((a, b) => day(a) - day(b) || time(a).localeCompare(time(b)));
};
const tokyo = trip(TRIP_IDS.tokyo);
const tokyoItems = sorted(TRIP_IDS.tokyo);
const places = new Map(seed.places.map((p) => [p.id, p]));

describe("itemsByDay", () => {
  it("puts flights on their departure day (Planner mockup)", () => {
    const days = itemsByDay(tokyoItems, tokyo);
    expect(days.map((d) => d.length)).toEqual([3, 3, 2, 3]);
    expect(days[0][0].kind).toBe("transit");
    expect(days[3].at(-1)?.kind).toBe("transit");
  });
});

describe("placeDays / unscheduledPlaces", () => {
  it("counts transit endpoints as scheduled (Haneda on days 1 and 4)", () => {
    const days = placeDays(tokyoItems, tokyo);
    expect(days.get("t-haneda")).toEqual([1, 4]);
    expect(days.get("t-hotel")).toEqual([1, 4]);
  });

  it("finds the 3 Unscheduled Places of the Tokyo trip", () => {
    const tokyoPlaces = seed.places.filter((p) => p.tripId === TRIP_IDS.tokyo);
    expect(unscheduledPlaces(tokyoPlaces, tokyoItems, tokyo).map((p) => p.name)).toEqual([
      "Omoide Yokocho",
      "ร้านเทมปุระเก่าแก่",
      "คาเฟ่ใต้ทางรถไฟ",
    ]);
  });
});

describe("dayAreasLabel", () => {
  it("lists distinct areas in order", () => {
    const days = itemsByDay(tokyoItems, tokyo);
    expect(dayAreasLabel(days[1], places)).toBe("Asakusa · Akihabara");
    expect(dayAreasLabel(days[0], places)).toBe("Shinjuku");
  });

  it("leads with the City Leg on multi-city trips", () => {
    const japan = trip(TRIP_IDS.japan);
    const days = itemsByDay(sorted(TRIP_IDS.japan), japan);
    expect(legCity(japan.legs, 5)).toBe("Kyoto");
    expect(dayAreasLabel(days[4], places, legCity(japan.legs, 5))).toBe("Kyoto › Fushimi");
    expect(dayAreasLabel(days[5], places, legCity(japan.legs, 6))).toBe("Kyoto");
  });
});

describe("resolveDay", () => {
  it("uses a valid ?day=", () => {
    expect(resolveDay("2", tokyo, "2026-11-11")).toBe(2);
    expect(resolveDay(["3"], tokyo, "2026-11-11")).toBe(3);
  });
  it("falls back to day 1 before the trip and today's day during it", () => {
    expect(resolveDay("9", tokyo, "2026-11-11")).toBe(1);
    expect(resolveDay("abc", tokyo, "2026-11-11")).toBe(1);
    expect(resolveDay(undefined, tokyo, "2026-12-14")).toBe(3);
    expect(resolveDay(undefined, tokyo, "2026-12-20")).toBe(1);
  });
});

describe("dayCardCaption", () => {
  it("matches the trip page mockup", () => {
    const days = itemsByDay(tokyoItems, tokyo);
    expect(days.map((d, i) => dayCardCaption(d, i + 1, 4))).toEqual(["3 ที่", "3 ที่", "2 ที่", "เดินทางกลับ"]);
    expect(dayCardCaption([], 2, 9)).toBe("ยังว่าง");
  });

  it("does not count a Transit without a linked Place as a place (APP-6)", () => {
    const flight: TransitPlanItem = {
      kind: "transit", id: "f", tripId: "t", mode: "plane", fromText: "สุวรรณภูมิ", toText: "เชียงใหม่",
      departAt: "2026-12-18T10:15", arriveAt: "2026-12-18T11:30", docIds: [], createdBy: "u",
    };
    expect(dayCardCaption([flight], 1, 3)).toBe("เดินทางไป");
    expect(dayCardCaption([flight], 2, 3)).toBe("วันเดินทาง");
    expect(dayCardCaption([flight], 3, 3)).toBe("เดินทางกลับ");
    expect(dayCardCaption([flight, tokyoItems[1]], 1, 3)).toBe("1 ที่");
    expect(dayCardCaption([{ ...flight, toPlaceId: "p-airport" }], 1, 3)).toBe("1 ที่");
  });
});

describe("text helpers", () => {
  it("formats hops and durations like the mockup", () => {
    expect(hopText({ mode: "train", minutes: 40, note: "ไปชินจูกุ" })).toBe("รถไฟ · ~40 นาที · ไปชินจูกุ");
    expect(hopText({ mode: "walk", minutes: 10 })).toBe("เดิน · ~10 นาที");
    expect(formatDuration(360)).toBe("6 ชม.");
    expect(formatDuration(450)).toBe("7 ชม. 30 นาที");
    expect(formatDuration(40)).toBe("40 นาที");
  });
});

describe("arrivalsOnDay", () => {
  const t = { startDate: "2027-01-27", endDate: "2027-01-31" };
  const flight = (departAt: string, arriveAt: string): TransitPlanItem => ({
    kind: "transit", id: departAt, tripId: "t", mode: "plane", fromText: "bkk", toText: "kix", departAt, arriveAt, docIds: [], createdBy: "u",
  });
  it("lists an overnight flight on the day it lands", () => {
    const f = flight("2027-01-27T23:40", "2027-01-28T03:39");
    expect(arrivalsOnDay([f], t, 2)).toEqual([f]);
    expect(arrivalsOnDay([f], t, 1)).toEqual([]);
  });
  it("ignores same-day flights", () => {
    const f = flight("2027-01-27T08:00", "2027-01-27T15:00");
    expect([1, 2, 3, 4, 5].flatMap((d) => arrivalsOnDay([f], t, d))).toEqual([]);
  });
  it("drops arrivals after the last trip day", () => {
    const f = flight("2027-01-31T23:00", "2027-02-01T05:00");
    expect([1, 2, 3, 4, 5].flatMap((d) => arrivalsOnDay([f], t, d))).toEqual([]);
  });
});

describe("nightsLodging", () => {
  const trip = { startDate: "2026-12-10", endDate: "2026-12-13" };
  const stay = (id: string, checkIn: string, checkOut: string) =>
    ({ id, type: "stay", stay: { checkIn, checkOut } }) as unknown as import("@/lib/api/types").Place;
  it("lists N-1 nights with the hotel that covers each", () => {
    const n = nightsLodging([stay("a", "2026-12-10", "2026-12-12"), stay("b", "2026-12-12", "2026-12-13")], trip);
    expect(n.map((x) => x.place?.id ?? null)).toEqual(["a", "a", "b"]);
  });
  it("leaves uncovered nights empty", () => {
    expect(nightsLodging([], trip).map((x) => x.place)).toEqual([null, null, null]);
  });
});

describe("stayTransitWarnings", () => {
  const t = { startDate: "2026-12-01" };
  const stay = (id: string, city: string, checkIn: string, checkOut: string) =>
    ({ id, name: id, city, type: "stay", stay: { checkIn, checkOut } }) as unknown as import("@/lib/api/types").Place;
  const train = (toText: string, day: string) =>
    ({ kind: "transit", id: "x", toText, fromText: "?", departAt: `${day}T09:00`, arriveAt: `${day}T11:00` }) as unknown as PlanItem;

  it("is quiet when check-in matches the transit day", () => {
    const places = [stay("A", "เกียวโต", "2026-12-01", "2026-12-06"), stay("B", "โอซาก้า", "2026-12-06", "2026-12-09")];
    expect(stayTransitWarnings(places, [train("โอซาก้า", "2026-12-06")], t)).toEqual([]);
  });
  it("warns when check-in and transit into the city are on different days", () => {
    const places = [stay("A", "เกียวโต", "2026-12-01", "2026-12-07"), stay("B", "โอซาก้า", "2026-12-06", "2026-12-09")];
    const w = stayTransitWarnings(places, [train("โอซาก้า", "2026-12-07")], t);
    expect(w.some((m) => m.includes("เดินทางเข้าโอซาก้าวันที่ 7"))).toBe(true);
    expect(w.some((m) => m.includes("ซ้อนกัน"))).toBe(true);
  });
  it("warns on a gap night and says nothing when the transit can't be matched", () => {
    const places = [stay("A", "เกียวโต", "2026-12-01", "2026-12-03"), stay("B", "โอซาก้า", "2026-12-05", "2026-12-08")];
    expect(stayTransitWarnings(places, [train("นาโกย่า", "2026-12-04")], t)).toEqual(["คืนวันที่ 3–4 ยังไม่มีที่พัก (ระหว่าง A กับ B)"]);
  });
  it("ignores a single stay", () => {
    expect(stayTransitWarnings([stay("A", "x", "2026-12-01", "2026-12-03")], [], t)).toEqual([]);
  });
});

describe("tripChecks", () => {
  type P = import("@/lib/api/types").Place;
  const stay = (id: string, checkIn: string, checkOut: string) => ({ id, name: id, city: "Tokyo", type: "stay", stay: { checkIn, checkOut } }) as unknown as P;
  const flight = (day: string) => ({ kind: "transit", id: `f${day}`, toText: "Tokyo", fromText: "BKK", departAt: `${day}T09:00`, arriveAt: `${day}T17:00` }) as unknown as PlanItem;
  // Japan: 10 days, 1–10 Dec (9 nights)
  const japan = { startDate: "2026-12-01", endDate: "2026-12-10" };

  it("warns when the outbound flight has no return", () => {
    const w = tripChecks([stay("A", "2026-12-01", "2026-12-10")], [flight("2026-12-01")], japan);
    expect(w).toEqual(["วันสุดท้าย (วันที่ 10) ยังไม่มีเที่ยวกลับ"]);
  });
  it("is quiet with a return flight on the last day", () => {
    expect(tripChecks([stay("A", "2026-12-01", "2026-12-10")], [flight("2026-12-01"), flight("2026-12-10")], japan)).toEqual([]);
  });
  it("says nothing for a driving trip with no transit and no stays", () => {
    const huaHin = { startDate: "2026-12-18", endDate: "2026-12-20" };
    expect(tripChecks([], [], huaHin)).toEqual([]);
  });
  it("warns about nights after the last stay and before the first", () => {
    expect(tripChecks([stay("A", "2026-12-01", "2026-12-08")], [], japan)).toEqual(["คืนที่ 8–9 ยังไม่มีที่พัก"]);
    expect(tripChecks([stay("A", "2026-12-03", "2026-12-10")], [], japan)).toEqual(["คืนที่ 1–2 ยังไม่มีที่พัก"]);
    expect(tripChecks([stay("A", "2026-12-01", "2026-12-09")], [], japan)).toEqual(["คืนที่ 9 ยังไม่มีที่พัก"]);
  });
  it("keeps the existing gap warning and does not repeat it", () => {
    const w = tripChecks([stay("A", "2026-12-01", "2026-12-03"), stay("B", "2026-12-05", "2026-12-10")], [], japan);
    expect(w).toEqual(["คืนวันที่ 3–4 ยังไม่มีที่พัก (ระหว่าง A กับ B)"]);
  });
});

describe("placeVisits / formatVisitLine", () => {
  const visit = (id: string, placeId: string, day: number, time: string | null): PlanItem => ({ kind: "place", id, tripId: "t", day, time, placeId, note: "", createdBy: "act" });
  const items = [visit("1", "p", 4, null), visit("2", "p", 2, "19:00"), visit("3", "p", 2, "09:30"), visit("4", "q", 1, "10:00")];
  const trip = { startDate: "2026-12-17" };

  it("sorts a Place's visits by day, then time, untimed last", () => {
    expect(placeVisits(items, trip).get("p")).toEqual([
      { day: 2, time: "09:30" },
      { day: 2, time: "19:00" },
      { day: 4, time: null },
    ]);
  });

  it("includes transit endpoints, on the leave / arrive day", () => {
    const flight: PlanItem = { kind: "transit", id: "x", tripId: "t", mode: "plane", fromCode: "BKK", fromText: "สุวรรณภูมิ", toCode: "NRT", toText: "นาริตะ", departAt: "2026-12-17T23:00", arriveAt: "2026-12-18T07:00", docIds: [], fromPlaceId: "a", toPlaceId: "b", createdBy: "act" };
    const v = placeVisits([flight], trip);
    expect(v.get("a")).toEqual([{ day: 1, time: "23:00", label: "ออกเดินทาง (เครื่องบิน → NRT)" }]);
    expect(v.get("b")).toEqual([{ day: 2, time: "07:00", label: "ถึง (เครื่องบิน จาก BKK)" }]);
  });

  it("agrees with placeDays on every Place (Tokyo)", () => {
    const visits = placeVisits(tokyoItems, tokyo);
    const days = placeDays(tokyoItems, tokyo);
    expect([...visits.keys()].sort()).toEqual([...days.keys()].sort());
    for (const [id, list] of visits) expect([...new Set(list.map((x) => x.day))]).toEqual(days.get(id));
    expect(visits.get("t-haneda")?.length).toBeGreaterThan(0);
  });

  it("formats a visit line from the trip start date", () => {
    expect(formatVisitLine({ day: 2, time: "19:00" }, "2026-12-17")).toBe("วัน 2 · ศ. 18 ธ.ค. · 19:00");
    expect(formatVisitLine({ day: 4, time: null }, "2026-12-17")).toBe("วัน 4 · อา. 20 ธ.ค. · ยังไม่ระบุเวลา");
    expect(formatVisitLine({ day: 1, time: "10:30", label: "ถึง (เครื่องบิน จาก BKK)" }, "2026-12-17")).toBe("วัน 1 · พฤ. 17 ธ.ค. · 10:30 · ถึง (เครื่องบิน จาก BKK)");
  });
});
