import { describe, expect, it } from "vitest";
import { hourStart, last24Hours, lastBangkokDays, p95, tripStatus } from "./admin-stats.js";

describe("tripStatus", () => {
  const trip = { startDate: "2026-12-10", endDate: "2026-12-14" };
  it("compares the Bangkok date with the trip dates", () => {
    expect(tripStatus(trip, "2026-12-09")).toBe("upcoming");
    expect(tripStatus(trip, "2026-12-10")).toBe("ongoing");
    expect(tripStatus(trip, "2026-12-14")).toBe("ongoing");
    expect(tripStatus(trip, "2026-12-15")).toBe("past");
  });
});

describe("lastBangkokDays", () => {
  it("lists n dates ending on the Bangkok date, and ranges at Bangkok midnight", () => {
    // 18:00 UTC on the 10th is already the 11th in Bangkok
    const { dates, current, previous } = lastBangkokDays(new Date("2026-11-10T18:00:00Z"), 3);
    expect(dates).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(current.from.toISOString()).toBe("2026-11-08T17:00:00.000Z");
    expect(current.to.toISOString()).toBe("2026-11-11T17:00:00.000Z");
    expect(previous.to).toEqual(current.from);
    expect(previous.from.toISOString()).toBe("2026-11-05T17:00:00.000Z");
  });
});

describe("p95", () => {
  it("uses nearest rank and is null when empty", () => {
    expect(p95([])).toBeNull();
    expect(p95([5])).toBe(5);
    expect(p95(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(95);
  });
});

describe("hours", () => {
  it("returns 24 hour starts, oldest first", () => {
    const hours = last24Hours(new Date("2026-11-11T12:34:56Z"));
    expect(hours).toHaveLength(24);
    expect(hours[23]).toEqual(hourStart(new Date("2026-11-11T12:34:56Z")));
    expect(hours[0]?.toISOString()).toBe("2026-11-10T13:00:00.000Z");
  });
});
