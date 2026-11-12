import { describe, expect, it } from "vitest";
import type { Member, TripBalances } from "@/lib/api/types";
import { canAddExpense, canConfirm, canEditExpense, canMarkSent, visibleBalances } from "./permissions";

const owner = { id: "act", role: "owner" as const };
const editor = { id: "mint", role: "editor" as const };
const viewer = { id: "n", role: "viewer" as const };

describe("expense permissions", () => {
  it("owner and editor can add, viewer cannot", () => {
    expect(canAddExpense(owner)).toBe(true);
    expect(canAddExpense(editor)).toBe(true);
    expect(canAddExpense(viewer)).toBe(false);
  });
  it("editor edits only their own expenses, owner edits all", () => {
    expect(canEditExpense(editor, { createdBy: "mint" })).toBe(true);
    expect(canEditExpense(editor, { createdBy: "act" })).toBe(false);
    expect(canEditExpense(owner, { createdBy: "mint" })).toBe(true);
    expect(canEditExpense(viewer, { createdBy: "n" })).toBe(false);
  });
});

describe("settlement permissions", () => {
  it("payer marks sent, receiver confirms", () => {
    expect(canMarkSent(viewer, { fromId: "n" })).toBe(true);
    expect(canMarkSent(owner, { fromId: "n" })).toBe(false);
    expect(canConfirm(owner, { toId: "act", status: "sent" })).toBe(true);
    expect(canConfirm(owner, { toId: "act", status: "pending" })).toBe(false);
    expect(canConfirm(editor, { toId: "act", status: "sent" })).toBe(false);
  });
});

describe("plan and tag permissions", () => {
  it("owner and editor edit the plan, viewer cannot", async () => {
    const { canEditPlan, canManageTag } = await import("./permissions");
    expect(canEditPlan(owner)).toBe(true);
    expect(canEditPlan(editor)).toBe(true);
    expect(canEditPlan(viewer)).toBe(false);
    expect(canManageTag("act", { ownerId: "act" })).toBe(true);
    expect(canManageTag("n", { ownerId: "act" })).toBe(false);
  });
});

describe("own-only plan editing and owner-only trip structure", () => {
  it("editor edits only Places / Plan Items they created, owner edits all", async () => {
    const { canEditPlanEntry, canEditTripStructure } = await import("./permissions");
    expect(canEditPlanEntry(editor, { createdBy: "mint" })).toBe(true);
    expect(canEditPlanEntry(editor, { createdBy: "act" })).toBe(false);
    expect(canEditPlanEntry(owner, { createdBy: "mint" })).toBe(true);
    expect(canEditPlanEntry(viewer, { createdBy: "n" })).toBe(false);
    expect(canEditTripStructure(owner)).toBe(true);
    expect(canEditTripStructure(editor)).toBe(false);
    expect(canEditTripStructure(viewer)).toBe(false);
  });
});

describe("visibleBalances", () => {
  const m = (id: string, role: Member["role"] = "editor"): Member => ({ id, tripId: "t", userId: id, displayName: id, role, color: "gray" });
  const row = (id: string, outstanding: number) => ({ member: m(id), paid: 0, share: 0, net: outstanding, outstanding });
  const balances: TripBalances = {
    total: 3_035_000,
    rows: [row("act", 1_095_000), row("mint", 0), row("beam", -580_000), row("ploy", -515_000)],
    transfers: [
      { from: m("beam"), to: m("act"), amount: 580_000, settlement: null },
      { from: m("ploy"), to: m("act"), amount: 515_000, settlement: null },
    ],
  };

  it("gives owner and editor every row and transfer", () => {
    expect(visibleBalances(balances, owner)).toEqual(balances);
    expect(visibleBalances(balances, editor)).toEqual(balances);
  });

  it("gives a viewer only their own row and their own transfers, with the whole-trip total", () => {
    const v = visibleBalances(balances, { id: "beam", role: "viewer" });
    expect(v.total).toBe(3_035_000);
    expect(v.rows.map((r) => r.member.id)).toEqual(["beam"]);
    expect(v.transfers.map((t) => `${t.from.id}>${t.to.id}`)).toEqual(["beam>act"]);
  });

  it("keeps transfers a viewer receives", () => {
    const v = visibleBalances(balances, { id: "act", role: "viewer" });
    expect(v.transfers).toHaveLength(2);
    expect(v.rows.map((r) => r.member.id)).toEqual(["act"]);
  });
});
