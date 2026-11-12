import { describe, expect, it } from "vitest";
import type { TransferRow } from "./expenses";
import { myOtherRows, pickSettleRow, settleViewer } from "./settle-view";

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
