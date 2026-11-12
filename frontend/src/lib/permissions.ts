/**
 * Permission checks for pages: which buttons to show or disable. UX only — the
 * backend decides every write (docs/adr/0001).
 * SPEC "สิทธิ์": owner edits everything; editor adds expenses and edits/deletes
 * only the ones they created; viewer only views and reports transfers.
 */
import type { Expense, Member, Settlement, TripBalances } from "@/lib/api/types";

type Me = Pick<Member, "id" | "role">;

export function canAddExpense(me: Me): boolean {
  return me.role === "owner" || me.role === "editor";
}

export function canEditExpense(me: Me, expense: Pick<Expense, "createdBy">): boolean {
  if (me.role === "owner") return true;
  return me.role === "editor" && expense.createdBy === me.id;
}

/** Only the payer reports a transfer as sent (any role, viewers included). */
export function canMarkSent(me: Me, transfer: Pick<Settlement, "fromId">): boolean {
  return transfer.fromId === me.id;
}

/**
 * What GET balances returns for this Member: a viewer gets only their own row
 * and the transfers they send or receive; owner/editor get everything.
 * `total` stays the whole trip either way (matches the backend).
 */
export function visibleBalances(balances: TripBalances, me: Me): TripBalances {
  if (me.role !== "viewer") return balances;
  return {
    total: balances.total,
    rows: balances.rows.filter((r) => r.member.id === me.id),
    transfers: balances.transfers.filter((t) => t.from.id === me.id || t.to.id === me.id),
  };
}

/** Only the receiver confirms a transfer they got. */
export function canConfirm(me: Me, settlement: Pick<Settlement, "toId" | "status">): boolean {
  return settlement.toId === me.id && settlement.status === "sent";
}

/** Adding Places, Plan Items and Transit: owner and editor (viewers only look). */
export function canEditPlan(me: Me): boolean {
  return me.role === "owner" || me.role === "editor";
}

/**
 * Changing or deleting a Place or a Plan Item (incl. its Hop): owner edits all,
 * an editor only what they created (first-frontend.md "สิทธิ์แก้ไข").
 */
export function canEditPlanEntry(me: Me, entry: { createdBy: string }): boolean {
  if (me.role === "owner") return true;
  return me.role === "editor" && entry.createdBy === me.id;
}

/** Renaming / merging Areas (ManageTags) and editing City Legs (TripRoute): owner only. */
export function canEditTripStructure(me: Me): boolean {
  return me.role === "owner";
}

/** Tags belong to a User; only the owner renames, regroups or deletes them. */
export function canManageTag(userId: string, tag: { ownerId: string }): boolean {
  return tag.ownerId === userId;
}

/** Members, roles and the invite link: owner only (SPEC "สิทธิ์"). */
export function canManageMembers(me: Me): boolean {
  return me.role === "owner";
}

/**
 * Checklist: everyone ticks group items; owner/editor add, assign and delete
 * group items; personal items belong to their owner alone.
 */
export function canEditChecklistItem(me: Me, item: { scope: "group" | "personal"; ownerId?: string }): boolean {
  if (item.scope === "personal") return item.ownerId === me.id;
  return me.role === "owner" || me.role === "editor";
}

export function canTickChecklistItem(me: Me, item: { scope: "group" | "personal"; ownerId?: string }): boolean {
  return item.scope === "group" || item.ownerId === me.id;
}

/** Trip documents (B12 without `kind`): owner and editor upload. */
export function canUploadDocument(me: Me): boolean {
  return me.role === "owner" || me.role === "editor";
}

/** B14: the owner, or the Member who uploaded it. */
export function canDeleteDocument(me: Me, doc: { uploadedBy: string }): boolean {
  return me.role === "owner" || doc.uploadedBy === me.id;
}
