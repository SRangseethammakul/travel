/**
 * The one-shot confirmation message a Server Action leaves for the next page
 * (save / edit / delete toasts). Carried by a short-lived `flash` cookie that
 * the client toast reads and clears. Pure, so the action side and the toast
 * share it.
 */
export const FLASH_COOKIE = "flash";
/** Dispatched on `window` when an action did not navigate: the toast looks for a fresh cookie. */
export const FLASH_EVENT = "flash:check";
/** Seconds the cookie lives if the page never reads it. */
export const FLASH_MAX_AGE = 30;

export interface Flash {
  message: string;
  /** An error keeps the toast longer and is announced as an alert. */
  tone?: "error";
  /** Internal links only. */
  link?: { href: string; label: string };
}

const MAX_MESSAGE = 200;

export function serializeFlash(flash: Flash): string {
  return JSON.stringify({
    message: flash.message.slice(0, MAX_MESSAGE),
    ...(flash.tone ? { tone: flash.tone } : {}),
    ...(flash.link ? { link: { href: flash.link.href, label: flash.link.label.slice(0, 40) } } : {}),
  });
}

/** `raw` is the cookie value, URI-encoded or not. Anything malformed (or an off-site link) is dropped. */
export function parseFlash(raw: string | null | undefined): Flash | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.startsWith("{") ? raw : decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { message, tone, link } = data as Record<string, unknown>;
  if (typeof message !== "string" || !message.trim()) return null;
  const out: Flash = { message: message.slice(0, MAX_MESSAGE) };
  if (tone === "error") out.tone = "error";
  if (link && typeof link === "object") {
    const { href, label } = link as Record<string, unknown>;
    if (typeof href === "string" && typeof label === "string" && /^\/(?![/\\])/.test(href) && label.trim()) {
      out.link = { href, label: label.slice(0, 40) };
    }
  }
  return out;
}

/** Finds the flash in a `document.cookie` string. */
export function flashFromCookieString(cookie: string): Flash | null {
  for (const part of cookie.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === FLASH_COOKIE) return parseFlash(part.slice(i + 1).trim());
  }
  return null;
}
