/**
 * Backend error codes of the Settlement writes (B32–B34) where the UI acts
 * differently: the page the User acted on is out of date (someone already
 * reported, confirmed, or the balances changed), so it is re-rendered. The text
 * shown is always the backend's Thai `message`.
 */
const STALE_CODES = new Set([
  "already_sent",
  "nothing_owed",
  "receiver_not_owed",
  "amount_too_large",
  "invalid_status",
  "settlement_not_found",
]);

export function isStaleSettlementError(code: string): boolean {
  return STALE_CODES.has(code);
}
