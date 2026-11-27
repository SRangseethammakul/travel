import { describe, expect, it } from "vitest";
import { errorRateLabel, errorTotals, adminHref, barPercent, deltaText, formatSeen, formatUptime, ownersLabel, parsePage, pick, rangeLabel } from "./admin";

describe("admin helpers", () => {
  it("parses page numbers", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
    for (const bad of [undefined, "0", "-1", "x", "1.5"]) expect(parsePage(bad)).toBe(1);
  });
  it("picks only allowed values", () => {
    expect(pick("line", ["google", "line"] as const, "google")).toBe("line");
    expect(pick("evil", ["google", "line"] as const, "google")).toBe("google");
  });
  it("builds hrefs without empty params", () => {
    expect(adminHref("/admin/users", { q: "", page: 2, provider: undefined })).toBe("/admin/users?page=2");
    expect(adminHref("/admin/users", {})).toBe("/admin/users");
  });
  it("labels the visible range", () => {
    expect(rangeLabel(2, 20, 1284, 20)).toBe("แสดง 21–40 จาก 1,284");
    expect(rangeLabel(1, 20, 0, 0)).toBe("ไม่มีรายการ");
  });
  it("shows owners as first name + N", () => {
    expect(ownersLabel([])).toBe("—");
    expect(ownersLabel([{ name: "Act" }])).toBe("Act");
    expect(ownersLabel([{ name: "Act" }, { name: "Mint" }, { name: "Beam" }])).toBe("Act +2");
  });
  it("formats deltas and bars", () => {
    expect(deltaText(58, 62, "จากสัปดาห์ก่อน")).toEqual({ text: "−4 จากสัปดาห์ก่อน", down: true });
    expect(deltaText(5, 5, "x").down).toBe(false);
    expect(barPercent(0, 8)).toBe(0);
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(8, 8)).toBe(100);
  });
  it("formats last seen", () => {
    const now = new Date("2026-11-27T03:00:00Z");
    expect(formatSeen(null, now)).toBe("—");
    expect(formatSeen("2026-11-27T02:48:00Z", now)).toBe("12 นาทีที่แล้ว");
    expect(formatSeen("2026-11-27T01:00:00Z", now)).toBe("2 ชม.ที่แล้ว");
  });
  it("formats uptime", () => {
    expect(formatUptime(6 * 86_400 + 5)).toBe("6 วัน");
    expect(formatUptime(30)).toBe("1 นาที");
  });
  it("computes the error rate", () => {
    expect(errorTotals([{ c4xx: 2, c5xx: 1, total: 100 }, { c4xx: 1, c5xx: 0, total: 300 }])).toEqual({ c4xx: 3, c5xx: 1, total: 400 });
    expect(errorRateLabel(4, 1000)).toBe("0.4%");
    expect(errorRateLabel(0, 50)).toBe("0%");
    expect(errorRateLabel(0, 0)).toBeNull();
  });
});
