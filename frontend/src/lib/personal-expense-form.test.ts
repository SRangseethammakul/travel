import { describe, expect, it } from "vitest";
import { checkPersonalExpenseDraft, type PersonalExpenseDraft } from "./personal-expense-form";

const trip = { startDate: "2027-03-20", endDate: "2027-03-25" };
const draft: PersonalExpenseDraft = {
  title: "  ของฝาก Don Quijote ",
  category: "shopping",
  amount: 300_000,
  method: "card",
  date: "2027-03-22",
  note: "",
};

describe("checkPersonalExpenseDraft", () => {
  it("trims the title and turns an empty note into null", () => {
    expect(checkPersonalExpenseDraft(draft, trip)).toEqual({
      ok: true,
      value: { title: "ของฝาก Don Quijote", category: "shopping", amount: 300_000, method: "card", cardName: null, date: "2027-03-22", note: null },
    });
  });

  it("keeps a trimmed note", () => {
    const r = checkPersonalExpenseDraft({ ...draft, note: " ซื้อให้แม่ " }, trip);
    expect(r.ok && r.value.note).toBe("ซื้อให้แม่");
  });

  it("trims the card name, drops it for other methods and rejects over 30 characters", () => {
    const named = checkPersonalExpenseDraft({ ...draft, cardName: " UOB PRVI " }, trip);
    expect(named.ok && named.value.cardName).toBe("UOB PRVI");
    const cash = checkPersonalExpenseDraft({ ...draft, method: "cash", cardName: "UOB" }, trip);
    expect(cash.ok && cash.value.cardName).toBeNull();
    expect(checkPersonalExpenseDraft({ ...draft, cardName: "x".repeat(31) }, trip)).toEqual({ ok: false, error: "ชื่อบัตรยาวได้ไม่เกิน 30 ตัวอักษร" });
  });

  it("accepts the first and last trip day", () => {
    expect(checkPersonalExpenseDraft({ ...draft, date: trip.startDate }, trip).ok).toBe(true);
    expect(checkPersonalExpenseDraft({ ...draft, date: trip.endDate }, trip).ok).toBe(true);
  });

  it.each([
    [{ amount: 0 }, "ใส่จำนวนเงินมากกว่า 0"],
    [{ amount: 12.5 }, "ใส่จำนวนเงินมากกว่า 0"],
    [{ title: "   " }, "ใส่ชื่อรายการ"],
    [{ title: "x".repeat(201) }, "ชื่อรายการยาวได้ไม่เกิน 200 ตัวอักษร"],
    [{ category: "gift" }, "เลือกหมวดหมู่"],
    [{ method: "cheque" }, "เลือกช่องทางชำระเงิน"],
    [{ date: "2027-03-19" }, "เลือกวันที่ภายในช่วงทริป"],
    [{ date: "2027-03-26" }, "เลือกวันที่ภายในช่วงทริป"],
    [{ date: "" }, "เลือกวันที่ภายในช่วงทริป"],
    [{ note: "x".repeat(2001) }, "โน้ตยาวได้ไม่เกิน 2000 ตัวอักษร"],
  ])("rejects %o", (patch, error) => {
    expect(checkPersonalExpenseDraft({ ...draft, ...patch } as PersonalExpenseDraft, trip)).toEqual({ ok: false, error });
  });
});
