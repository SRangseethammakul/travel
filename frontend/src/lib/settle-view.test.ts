import { describe, expect, it } from "vitest";
import type { TransferRow } from "./expenses";
import { myOtherRows, pickSettleRow, settleAmount, settleViewer, transferStrip, waitingAmount } from "./settle-view";

// Tokyo trip: Mint → Act confirmed ฿3,100, Beam → Act sent ฿5,800, Ploy → Act pending ฿5,150.
const rows: TransferRow[] = [
  { key: "s-mint", fromId: "mint", toId: "act", amount: 310_000, status: "confirmed" },
  { key: "beam>act", fromId: "beam", toId: "act", amount: 580_000, status: "sent" },
  { key: "ploy>act", fromId: "ploy", toId: "act", amount: 515_000, status: "pending" },
];

describe("pickSettleRow", () => {
  it("shows what the payer still owes", () => {
    expect(pickSettleRow(rows, "ploy")?.key).toBe("ploy>act");
    expect(pickSettleRow(rows, "beam")?.key).toBe("beam>act");
  });
  it("receiver sees the transfer waiting for confirmation first", () => {
    expect(pickSettleRow(rows, "act")?.key).toBe("beam>act");
  });
  it("a settled member sees their confirmed transfer", () => {
    expect(pickSettleRow(rows, "mint")?.key).toBe("s-mint");
  });
  it("uses ?from=&to= when given, preferring an open row", () => {
    expect(pickSettleRow(rows, "act", { from: "ploy", to: "act" })?.key).toBe("ploy>act");
    expect(pickSettleRow(rows, "act", { from: "mint", to: "act" })?.key).toBe("s-mint");
    expect(pickSettleRow(rows, "act", { from: "act", to: "mint" })).toBeNull();
  });
});

describe("settleViewer / myOtherRows", () => {
  it("tells payer from receiver", () => {
    expect(settleViewer(rows[2], "ploy")).toBe("payer");
    expect(settleViewer(rows[2], "act")).toBe("receiver");
    expect(settleViewer(rows[2], "mint")).toBe("other");
  });
  it("lists other open transfers that involve me", () => {
    expect(myOtherRows(rows, "act", rows[1]).map((r) => r.key)).toEqual(["ploy>act"]);
    expect(myOtherRows(rows, "ploy", rows[2])).toEqual([]);
  });
});

// QA plan step 7a: Eva owes Adam ฿650 and reports ฿400; ฿250 waits for Adam's confirmation.
const partial: TransferRow[] = [
  { key: "eva>adam", fromId: "eva", toId: "adam", amount: 40_000, status: "sent" },
  { key: "eva>adam:rest", fromId: "eva", toId: "adam", amount: 25_000, status: "waiting" },
];

describe("partial report", () => {
  it("opens on the sent row, never the waiting remainder", () => {
    expect(pickSettleRow(partial, "eva")?.key).toBe("eva>adam");
    expect(pickSettleRow(partial, "adam", { from: "eva", to: "adam" })?.key).toBe("eva>adam");
    expect(pickSettleRow([partial[1]], "eva")).toBeNull();
  });
  it("does not list the remainder of the same pair as another transfer", () => {
    expect(myOtherRows(partial, "eva", partial[0])).toEqual([]);
  });
  it("finds what is left of the pair", () => {
    expect(waitingAmount(partial, partial[0])).toBe(25_000);
    expect(waitingAmount(rows, rows[1])).toBe(0);
  });
});

describe("settleAmount", () => {
  it("accepts any amount up to what is still owed", () => {
    expect(settleAmount("400", 65_000)).toEqual({ amount: 40_000 });
    expect(settleAmount("650", 65_000)).toEqual({ amount: 65_000 });
    expect(settleAmount("0.01", 65_000)).toEqual({ amount: 1 });
    expect(settleAmount("5,150.50", 515_050)).toEqual({ amount: 515_050 });
  });
  it("refuses empty or zero", () => {
    expect(settleAmount("", 65_000)).toEqual({ error: "ใส่ยอดที่โอน" });
    expect(settleAmount("0", 65_000)).toEqual({ error: "ใส่ยอดที่โอน" });
  });
  it("refuses more than what is owed, naming the limit", () => {
    expect(settleAmount("650.01", 65_000)).toEqual({ error: "ยอดโอนต้องไม่เกินยอดที่ค้าง ฿650" });
  });
  it("refuses more than 2 decimals or non-numbers", () => {
    expect(settleAmount("12.345", 65_000)).toEqual({ error: "ใส่ยอดเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" });
    expect(settleAmount("abc", 65_000)).toEqual({ error: "ใส่ยอดเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง" });
  });
});

describe("transferStrip", () => {
  it("payer sees pending rows to pay; receiver sees sent rows to confirm", () => {
    expect(transferStrip(rows, "ploy")).toEqual({ toPay: [rows[2]], toConfirm: [] });
    expect(transferStrip(rows, "act")).toEqual({ toPay: [], toConfirm: [rows[1]] });
  });
  it("omits confirmed rows, so a settled member sees nothing", () => {
    expect(transferStrip(rows, "mint")).toEqual({ toPay: [], toConfirm: [] });
  });
  it("keeps a partial report's sent row before its waiting remainder", () => {
    const partial: TransferRow[] = [
      { key: "beam>act", fromId: "beam", toId: "act", amount: 300_000, status: "sent" },
      { key: "beam>act:rest", fromId: "beam", toId: "act", amount: 280_000, status: "waiting" },
    ];
    expect(transferStrip(partial, "beam").toPay.map((r) => r.status)).toEqual(["sent", "waiting"]);
    expect(transferStrip(partial, "act").toConfirm.map((r) => r.amount)).toEqual([300_000]);
  });
});
