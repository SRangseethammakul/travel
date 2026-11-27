/**
 * Request path safe to log: the query string is dropped (signed file URLs carry their token
 * there) and the invite token in `/api/join/<token>` becomes `:token` (it is a bearer secret).
 * Express matches paths case-insensitively, so this does too.
 */
export function redactPath(path: string): string {
  const withoutQuery = path.split("?", 1)[0] ?? "";
  return withoutQuery.replace(/^(\/api\/join\/)[^/]+/i, "$1:token");
}
