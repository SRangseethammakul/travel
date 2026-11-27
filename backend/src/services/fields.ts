/**
 * Splits a validated patch into `$set` and `$unset`: a key in `removable` sent as `null` is
 * removed (optional fields); any other `null` is stored as null (e.g. `budget`).
 */
export function setAndUnset<T extends object>(patch: T, removable: readonly (keyof T & string)[]) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(patch) as [string, unknown][]) {
    if (value === undefined) continue;
    if (value === null && (removable as readonly string[]).includes(key)) $unset[key] = "";
    else $set[key] = value;
  }
  return { $set, $unset };
}
