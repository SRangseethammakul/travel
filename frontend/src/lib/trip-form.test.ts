import { describe, expect, it } from "vitest";
import { checkTripDetails, checkTripDraft, memberColor } from "./trip-form";

const details = { name: "  QA-เชียงใหม่ ", destination: "เชียงใหม่", startDate: "2026-12-18", endDate: "2026-12-20" };

describe("checkTripDetails (แก้ไขทริป)", () => {
  it("trims and accepts a valid trip", () => {
    expect(checkTripDetails(details)).toEqual({ ok: true, details: { ...details, name: "QA-เชียงใหม่" } });
  });

  it("rejects an empty name, a missing destination and reversed dates", () => {
    expect(checkTripDetails({ ...details, name: "  " })).toMatchObject({ ok: false, field: "name" });
    expect(checkTripDetails({ ...details, destination: "" })).toMatchObject({ ok: false, field: "destination" });
    expect(checkTripDetails({ ...details, endDate: "2026-12-17" })).toEqual({ ok: false, error: "วันกลับต้องไม่ก่อนวันไป", field: "dates" });
    expect(checkTripDetails({ ...details, startDate: "2026-02-30" })).toMatchObject({ ok: false, field: "dates" });
  });

  it("is the same check CreateTrip runs", () => {
    const draft = { ...details, name: "", budget: null, cover: "ink" as const, memberNames: [], documents: [] };
    expect(checkTripDraft(draft, "Adam")).toEqual({ ok: false, error: "ใส่ชื่อทริป", field: "name" });
  });
});

describe("memberColor", () => {
  it("matches the colours the backend saves (APP-7: Adam is gray, Eva gets teal)", () => {
    expect(memberColor(0, "gray")).toBe("teal");
    expect(memberColor(0, "teal")).toBe("blue");
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => memberColor(i, "teal"))).toEqual(["blue", "orange", "purple", "slate", "gray", "ink", "blue"]);
  });
});
