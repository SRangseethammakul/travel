import type { BalanceExpense, BalanceSettlement } from "./balance";

/** Tokyo trip from docs/design/screens/Summary.dc.html, in satang. Test-only fixture. */
export const tokyoMembers = ["act", "mint", "beam", "ploy"] as const;

const equal = (payerId: string, amount: number, ids: readonly string[]): BalanceExpense => ({
  payerId,
  amount,
  shares: ids.map((memberId) => ({ memberId, amount: amount / ids.length })),
});

export const tokyoExpenses: BalanceExpense[] = [
  equal("act", 2200000, ["act", "mint", "beam", "ploy"]), // ที่พัก 3 คืน
  equal("beam", 105000, ["act", "beam", "ploy"]), // Tokyo Subway Ticket
  equal("mint", 120000, ["act", "mint", "beam", "ploy"]), // ร้านราเมงซุปเข้มข้น
  equal("ploy", 280000, ["act", "mint", "beam", "ploy"]), // ตั๋ว Tokyo Skytree
  equal("mint", 330000, ["act", "mint", "ploy"]), // ชาบูบุฟเฟ่ต์
];

export const tokyoSettlements: BalanceSettlement[] = [
  { fromId: "mint", toId: "act", amount: 310000, status: "confirmed" },
  { fromId: "beam", toId: "act", amount: 580000, status: "sent" },
];
