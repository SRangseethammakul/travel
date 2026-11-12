/** Trip calendar helpers (pure). Dates are `YYYY-MM-DD`, read as UTC so there is no timezone shift. */

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;

/** Number of days in a trip, inclusive (12–15 Dec → 4). */
export function tripDayCount(startDate: string, endDate: string): number {
  return dayNumber(endDate) - dayNumber(startDate) + 1;
}

/** Today's calendar date in Thailand (trip tabs "กำลังจะไป / ผ่านมาแล้ว"). */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}
