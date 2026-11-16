import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatCountdown,
  formatTimestamp,
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatLongDayMonth,
  formatMonthYear,
  formatTripLength,
  formatWeekdayDay,
  parseISODate,
  todayISO,
  tripDayDate,
  tripPhase,
} from "./date";

describe("Thai date formatting", () => {
  it("formats the Tokyo trip range like the mockup", () => {
    expect(formatDateRange("2026-12-12", "2026-12-15")).toBe("ส. 12 – อ. 15 ธ.ค. 2569");
  });

  it("formats the Japan trip range", () => {
    expect(formatDateRange("2027-03-20", "2027-03-28")).toBe("ส. 20 – อา. 28 มี.ค. 2570");
  });

  it("handles ranges across months and years", () => {
    expect(formatDateRange("2026-11-28", "2026-12-01")).toBe("ส. 28 พ.ย. – อ. 1 ธ.ค. 2569");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("พ. 30 ธ.ค. 2569 – ส. 2 ม.ค. 2570");
    expect(formatDateRange("2026-12-12", "2026-12-12")).toBe("ส. 12 ธ.ค. 2569");
  });

  it("formats single dates", () => {
    expect(formatDate("2026-12-12")).toBe("ส. 12 ธ.ค. 2569");
    expect(formatWeekdayDay("2026-12-13")).toBe("อา. 13");
    expect(formatDayMonth("2026-12-12")).toBe("ส. 12 ธ.ค.");
    expect(formatLongDayMonth("2026-12-14")).toBe("จันทร์ 14 ธ.ค.");
    expect(formatMonthYear("2026-06-13")).toBe("มิ.ย. 2569");
  });

  it("uses fixed weekday names, the same on the server and in the browser (APP-9)", () => {
    // Node's ICU says "พฤหัส" for a short Thursday, browsers say "พฤ.".
    expect(formatDateRange("2026-11-26", "2026-11-29")).toBe("พฤ. 26 – อา. 29 พ.ย. 2569");
    expect(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"].map(formatWeekdayDay)).toEqual(["จ. 23", "อ. 24", "พ. 25", "พฤ. 26", "ศ. 27"]);
    expect(formatLongDayMonth("2026-11-26")).toBe("พฤหัสบดี 26 พ.ย.");
  });

  it("formats trip length", () => {
    expect(formatTripLength("2026-12-12", "2026-12-15")).toBe("4 วัน 3 คืน");
    expect(formatTripLength("2026-06-13", "2026-06-13")).toBe("1 วัน");
  });
});

describe("day counting", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-11-11", "2026-12-12")).toBe(31);
    expect(daysBetween("2026-12-15", "2026-12-12")).toBe(-3);
    expect(daysBetween("2027-02-27", "2027-03-01")).toBe(2);
  });

  it("adds days and finds trip day dates", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(tripDayDate("2026-12-12", 4)).toBe("2026-12-15");
  });

  it("gives the same trip day date in any process timezone (no UTC/Bangkok off-by-one)", () => {
    const prev = process.env.TZ;
    try {
      for (const tz of ["Asia/Bangkok", "UTC", "America/Los_Angeles", "Pacific/Auckland"]) {
        process.env.TZ = tz;
        expect(tripDayDate("2027-04-05", 4)).toBe("2027-04-08");
        expect(addDays("2027-04-05", 3)).toBe("2027-04-08");
      }
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });

  it("works out the countdown from the real date (not the mockup's 34 days)", () => {
    expect(formatCountdown("2026-11-11", "2026-12-12", "2026-12-15")).toBe("อีก 31 วัน");
    expect(formatCountdown("2026-12-11", "2026-12-12", "2026-12-15")).toBe("พรุ่งนี้");
    expect(formatCountdown("2026-12-12", "2026-12-12", "2026-12-15")).toBe("วันนี้");
    expect(formatCountdown("2026-12-13", "2026-12-12", "2026-12-15")).toBe("วันที่ 2 ของทริป");
    expect(formatCountdown("2026-12-16", "2026-12-12", "2026-12-15")).toBe("จบแล้ว");
  });

  it("classifies upcoming / ongoing / past", () => {
    expect(tripPhase("2026-11-11", "2026-12-12", "2026-12-15")).toBe("upcoming");
    expect(tripPhase("2026-12-15", "2026-12-12", "2026-12-15")).toBe("ongoing");
    expect(tripPhase("2026-11-11", "2026-06-13", "2026-06-14")).toBe("past");
  });

  it("takes today in Bangkok time", () => {
    // 2026-11-11 20:00 UTC is already 12 Nov in Bangkok (UTC+7)
    expect(todayISO(new Date("2026-11-11T20:00:00Z"))).toBe("2026-11-12");
    expect(todayISO(new Date("2026-11-11T10:00:00Z"))).toBe("2026-11-11");
  });

  it("rejects invalid dates", () => {
    expect(() => parseISODate("2026-02-30")).toThrow(RangeError);
    expect(() => parseISODate("12/12/2026")).toThrow(RangeError);
  });
});

describe("formatTimestamp", () => {
  it("formats in Bangkok time with the Buddhist year", () => {
    expect(formatTimestamp("2026-11-08T14:30:00.000Z")).toBe("8 พ.ย. 2569 21:30");
  });
  it("uses วันนี้ / เมื่อวาน relative to now", () => {
    const now = new Date("2026-11-11T15:00:00.000Z"); // 22:00 in Bangkok
    expect(formatTimestamp("2026-11-11T14:58:00.000Z", now)).toBe("วันนี้ 21:58");
    expect(formatTimestamp("2026-11-10T02:10:00.000Z", now)).toBe("เมื่อวาน 09:10");
    expect(formatTimestamp("2026-11-08T14:30:00.000Z", now)).toBe("8 พ.ย. 2569 21:30");
  });
});
