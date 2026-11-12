import { describe, expect, it } from "vitest";
import { netBalances, outstandingBalances, totalSpent } from "@/lib/money/balance";
import { sharesMatchTotal } from "@/lib/money/split";
import { createSeed, memberId, TRIP_IDS } from "./seed";

const seed = createSeed(new Date("2026-11-11T10:00:00Z"));

function tripMoney(tripId: string) {
  const ids = seed.members.filter((m) => m.tripId === tripId).map((m) => m.id);
  const expenses = seed.expenses.filter((e) => e.tripId === tripId);
  const settlements = seed.settlements.filter((s) => s.tripId === tripId);
  const net = Object.fromEntries(netBalances(ids, expenses).map((r) => [r.memberId, r.net]));
  return { total: totalSpent(expenses), net, outstanding: outstandingBalances(ids, expenses, settlements) };
}

describe("seed integrity", () => {
  it("every expense's shares add up to its amount", () => {
    for (const e of seed.expenses) {
      expect(sharesMatchTotal(e.amount, e.shares), e.id).toBe(true);
      expect(e.baseAmount).toBe(e.amount);
      expect(e.currency).toBe("THB");
    }
  });

  it("all references point at existing records in the same trip", () => {
    const members = new Map(seed.members.map((m) => [m.id, m]));
    const places = new Map(seed.places.map((p) => [p.id, p]));
    const tagIds = new Set(seed.tags.map((t) => t.id));
    for (const e of seed.expenses) {
      expect(members.get(e.payerId)?.tripId).toBe(e.tripId);
      for (const s of e.shares) expect(members.get(s.memberId)?.tripId).toBe(e.tripId);
    }
    for (const s of seed.settlements) {
      expect(members.get(s.fromId)?.tripId).toBe(s.tripId);
      expect(members.get(s.toId)?.tripId).toBe(s.tripId);
    }
    for (const p of seed.places) for (const t of p.tagIds) expect(tagIds.has(t)).toBe(true);
    for (const item of seed.planItems) {
      if (item.kind === "place") expect(places.get(item.placeId)?.tripId).toBe(item.tripId);
    }
  });
});

describe("โตเกียวหน้าหนาว", () => {
  const T = TRIP_IDS.tokyo;
  const m = (k: string) => memberId(T, k);

  it("matches the Summary numbers", () => {
    const { total, net, outstanding } = tripMoney(T);
    expect(total).toBe(3035000);
    expect(net).toEqual({ [m("act")]: 1405000, [m("mint")]: -310000, [m("beam")]: -580000, [m("ploy")]: -515000 });
    expect(outstanding).toEqual({ [m("act")]: 1095000, [m("mint")]: 0, [m("beam")]: -580000, [m("ploy")]: -515000 });
  });

  it("has 12 places in 5 areas with 3 unscheduled", () => {
    const places = seed.places.filter((p) => p.tripId === T);
    expect(places).toHaveLength(12);
    expect(new Set(places.map((p) => p.area).filter(Boolean)).size).toBe(5);
    const scheduled = new Set<string>();
    for (const item of seed.planItems.filter((i) => i.tripId === T)) {
      if (item.kind === "place") scheduled.add(item.placeId);
      else [item.fromPlaceId, item.toPlaceId].forEach((id) => id && scheduled.add(id));
    }
    expect(places.filter((p) => !scheduled.has(p.id)).map((p) => p.name)).toEqual([
      "Omoide Yokocho",
      "ร้านเทมปุระเก่าแก่",
      "คาเฟ่ใต้ทางรถไฟ",
    ]);
  });
});

describe("other trips", () => {
  it("ญี่ปุ่นฤดูใบไม้ผลิ has 3 city legs, Act + N and no expenses", () => {
    const J = TRIP_IDS.japan;
    expect(seed.trips.find((t) => t.id === J)?.legs?.map((l) => l.city)).toEqual(["Tokyo", "Kyoto", "Osaka"]);
    expect(seed.members.filter((x) => x.tripId === J).map((x) => x.displayName)).toEqual(["Act", "N"]);
    expect(seed.expenses.filter((e) => e.tripId === J)).toHaveLength(0);
    expect(seed.places.filter((p) => p.tripId === J)).toHaveLength(16);
  });

  it("เขาใหญ่สุดสัปดาห์ totals ฿7,860 and Act owes ฿320", () => {
    const K = TRIP_IDS.khaoYai;
    const { total, outstanding } = tripMoney(K);
    expect(total).toBe(786000);
    expect(outstanding[memberId(K, "act")]).toBe(-32000);
    expect(Object.values(outstanding).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("เกาะล้าน totals ฿4,200 and everyone is settled", () => {
    const { total, outstanding } = tripMoney(TRIP_IDS.kohLarn);
    expect(total).toBe(420000);
    expect(Object.values(outstanding).every((v) => v === 0)).toBe(true);
  });
});
