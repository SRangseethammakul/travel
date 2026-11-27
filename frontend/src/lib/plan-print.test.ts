import { describe, expect, it } from "vitest";
import type { Place, PlanItem, Trip } from "@/lib/api/types";
import { buildPrintPlan, stayPhaseLine } from "./plan-print";

const trip: Trip = {
  id: "t",
  name: "Japan",
  destination: "Japan",
  startDate: "2026-12-10",
  endDate: "2026-12-14",
  budget: null,
  baseCurrency: "THB",
  cover: "teal",
  createdBy: "u",
  legs: [
    { city: "Tokyo", from: 1, to: 2 },
    { city: "Kyoto", from: 3, to: 5 },
  ],
};
const place = (id: string, over: Partial<Place> = {}): Place => ({ id, tripId: "t", name: id, type: "sight", city: "Tokyo", area: "Asakusa", tagIds: [], note: "", createdBy: "m", photos: [], ...over });
const places: Place[] = [
  place("temple", { note: "ไปเช้า", mapUrl: "https://maps.example/temple", costPerPerson: 50000 }),
  place("hotel", { type: "stay", area: null, stay: { checkIn: "2026-12-10", checkOut: "2026-12-12", checkInTime: "15:00", price: 990000, bookingRef: "H1", address: "1-2-3 Ueno", expenseId: "e1" } }),
];
const visit = (id: string, day: number, time: string | null, over: Partial<PlanItem> = {}): PlanItem => ({ kind: "place", id, tripId: "t", day, time, placeId: "temple", note: "", createdBy: "m", ...over }) as PlanItem;
const night: PlanItem = {
  kind: "transit", id: "bus", tripId: "t", mode: "bus", fromText: "Tokyo", toText: "Kyoto", toCode: "KYO",
  departAt: "2026-12-11T22:30", arriveAt: "2026-12-12T06:00", durationMinutes: 450, bookingRef: "B9", seatInfo: "12A", docIds: ["d1", "gone"], expenseId: "e2", createdBy: "m",
};

describe("buildPrintPlan", () => {
  it("lists every day, empty days included", () => {
    const days = buildPrintPlan(trip, places, [visit("a", 1, "10:00")]);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
    expect(days[1].timed).toEqual([]);
    expect(days[1].untimed).toEqual([]);
    expect(days[0].date).toBe("2026-12-10");
  });

  it("puts untimed items last and sorts timed by time", () => {
    const d = buildPrintPlan(trip, places, [visit("a", 1, null), visit("b", 1, "14:00"), visit("c", 1, "09:00")])[0];
    expect(d.timed.map((i) => i.id)).toEqual(["c", "b"]);
    expect(d.untimed.map((i) => i.id)).toEqual(["a"]);
  });

  it("shows an overnight transit on departure day and as an arrival on the next", () => {
    const days = buildPrintPlan(trip, places, [night], [{ id: "d1" }]);
    expect(days[1].timed[0]).toMatchObject({ kind: "transit", arriveTime: "06:00", duration: "7 ชม. 30 นาที", docCount: 1, bookingRef: "B9", seatInfo: "12A" });
    expect((days[1].timed[0] as { arriveDate: string }).arriveDate).toBeTruthy();
    expect(days[2].arrivals).toHaveLength(1);
    expect(days[2].arrivals[0]).toMatchObject({ time: "06:00", to: "KYO" });
    expect(days[0].arrivals).toEqual([]);
  });

  it("gives each day its city from the legs and none without legs", () => {
    expect(buildPrintPlan(trip, places, []).map((d) => d.city)).toEqual(["Tokyo", "Tokyo", "Kyoto", "Kyoto", "Kyoto"]);
    expect(buildPrintPlan({ ...trip, legs: undefined }, places, []).every((d) => d.city === null)).toBe(true);
  });

  it("says where to sleep tonight, none on the last day", () => {
    const days = buildPrintPlan(trip, places, []);
    expect(days.map((d) => d.nightAt)).toEqual(["hotel", "hotel", null, null, null]);
  });

  it("carries hop only between items and joins place + item notes", () => {
    const d = buildPrintPlan(trip, places, [
      visit("a", 1, "09:00", { note: "คิวยาว", travelToNext: { mode: "train", minutes: 20 } }),
      visit("b", 1, "11:00", { travelToNext: { mode: "walk", minutes: 5 } }),
    ])[0];
    expect(d.timed[0]).toMatchObject({ notes: ["ไปเช้า", "คิวยาว"], hop: expect.stringContaining("20") });
    expect(d.timed[1]).toMatchObject({ hop: null });
  });

  it("keeps stay details but no money fields anywhere", () => {
    const days = buildPrintPlan(trip, places, [visit("h", 1, "15:00", { placeId: "hotel" }), visit("t", 1, "10:00"), night], [{ id: "d1" }]);
    const stay = days[0].timed.find((i) => i.kind === "place" && i.stay);
    expect(stay).toMatchObject({ stay: { phase: "เช็คอิน 15:00", address: "1-2-3 Ueno", bookingRef: "H1" } });
    const json = JSON.stringify(days);
    for (const key of ["price", "costPerPerson", "expenseId", "photos", "990000", "50000"]) expect(json).not.toContain(key);
  });

  it("words a stay by phase of the day", () => {
    const s = { checkIn: "2026-12-10", checkOut: "2026-12-12", checkInTime: "15:00", checkOutTime: "11:00" };
    expect(stayPhaseLine(s, "2026-12-10")).toBe("เช็คอิน 15:00");
    expect(stayPhaseLine(s, "2026-12-11")).toBe("พักต่อ");
    expect(stayPhaseLine(s, "2026-12-12")).toBe("เช็คเอาท์ 11:00");
    expect(stayPhaseLine({ ...s, checkInTime: undefined, checkOutTime: undefined }, "2026-12-12")).toBe("เช็คเอาท์");
    expect(stayPhaseLine(s, "2026-12-13")).toBeUndefined();
  });
});
