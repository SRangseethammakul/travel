import { describe, expect, it } from "vitest";
import { createSeed, memberId } from "../../seed/data.js";
import { reportableAmount } from "./settle.js";
import { tripBalances } from "./trip.js";

describe("tripBalances on the seed", () => {
  const data = createSeed(new Date("2026-11-11T12:00:00.000Z"));
  const forTrip = (tripId: string) =>
    tripBalances(
      data.members.filter((m) => m.tripId === tripId).map((m) => m._id),
      data.expenses.filter((e) => e.tripId === tripId),
      data.settlements.filter((s) => s.tripId === tripId),
    );

  it("Tokyo: total ฿30,350, Outstanding Act +10,950 · Mint 0 · Beam −5,800 · Ploy −5,150", () => {
    const b = forTrip("tokyo-winter");
    expect(b.total).toBe(3_035_000);
    const out = Object.fromEntries(b.rows.map((r) => [r.memberId, r.outstanding]));
    expect(out).toEqual({
      [memberId("tokyo-winter", "act")]: 1_095_000,
      [memberId("tokyo-winter", "mint")]: 0,
      [memberId("tokyo-winter", "beam")]: -580_000,
      [memberId("tokyo-winter", "ploy")]: -515_000,
    });
  });

  it("Khao Yai: total ฿7,860 and Act owes ฿320; Koh Larn: everyone ฿0", () => {
    const k = forTrip("khao-yai");
    expect(k.total).toBe(786_000);
    expect(k.rows.find((r) => r.memberId === memberId("khao-yai", "act"))?.outstanding).toBe(-32_000);
    const l = forTrip("koh-larn");
    expect(l.total).toBe(420_000);
    expect(l.rows.every((r) => r.outstanding === 0)).toBe(true);
  });
});

describe("reportableAmount (BUG-B6): −Outstanding minus my sent Settlements", () => {
  const data = createSeed(new Date("2026-11-11T12:00:00.000Z"));
  const settlements = data.settlements.filter((s) => s.tripId === "tokyo-winter");
  const beam = memberId("tokyo-winter", "beam");
  const ploy = memberId("tokyo-winter", "ploy");

  it("Tokyo: Beam already reported ฿5,800 → 0 left; Ploy nothing reported → ฿5,150", () => {
    expect(reportableAmount(beam, -580_000, settlements)).toBe(0);
    expect(reportableAmount(ploy, -515_000, settlements)).toBe(515_000);
  });

  it("confirmed Settlements are already inside Outstanding; over-reporting goes negative", () => {
    const sent = [
      { fromId: ploy, amount: 500_000, status: "sent" },
      { fromId: ploy, amount: 100_000, status: "sent" },
      { fromId: ploy, amount: 999_999, status: "confirmed" },
    ];
    expect(reportableAmount(ploy, -515_000, sent)).toBe(-85_000);
  });
});
