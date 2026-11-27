import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { authorizeUrl, credentials, fetchProfile, type OAuthProfile, type Provider } from "../auth/oauth.js";
import { clearSession, setSession } from "../auth/session.js";
import type { Config } from "../config.js";
import { HttpError } from "../errors.js";
import * as auth from "../services/auth.service.js";
import { param } from "./params.js";

const STATE_COOKIE = "oauth-state";
const STATE_MS = 10 * 60_000;

const CallbackQuery = z.object({ state: z.string().optional(), code: z.string().optional(), error: z.string().optional() });
const StartQuery = z.object({ next: z.string().optional() });

/** Only same-site paths, so the login can't be used as an open redirect. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/trips";
}

function provider(value: string): Provider {
  if (value === "line" || value === "google") return value;
  throw new HttpError(404, "not_found", "ไม่พบสิ่งที่ต้องการ");
}

export function authController(config: Config) {
  const redirectUri = (p: Provider) => `${config.PUBLIC_API_URL}/api/auth/${p}/callback`;
  const configured = (p: Provider) => {
    const creds = credentials(config, p);
    if (!creds) throw new HttpError(404, "provider_disabled", "ยังไม่เปิดให้เข้าสู่ระบบด้วยช่องทางนี้");
    return creds;
  };

  /** B40 GET /api/auth/:provider?next= — redirect to LINE / Google. */
  const start: RequestHandler = (req, res) => {
    const p = provider(param(req, "provider"));
    const creds = configured(p);
    const { next } = StartQuery.parse(req.query);
    const state = randomBytes(16).toString("base64url");
    res.cookie(STATE_COOKIE, `${state}|${safeNext(next)}`, {
      signed: true,
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_MS,
      path: "/api/auth",
    });
    res.redirect(authorizeUrl(p, creds, redirectUri(p), state));
  };

  /** B41 GET /api/auth/:provider/callback — find or create the User, set the session, go back to `next`. */
  const callback: RequestHandler = async (req, res) => {
    const p = provider(param(req, "provider"));
    const creds = configured(p);
    const query = CallbackQuery.parse(req.query);
    const saved: unknown = req.signedCookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/api/auth" });
    const [state, next] = typeof saved === "string" ? saved.split("|", 2) : [];
    if (!state || state !== query.state) throw new HttpError(400, "invalid_state", "การเข้าสู่ระบบหมดเวลา กรุณาลองใหม่");
    if (!query.code) {
      res.redirect(`${config.CORS_ORIGIN}/login?error=cancelled`);
      return;
    }
    let profile: OAuthProfile;
    try {
      profile = await fetchProfile(p, creds, redirectUri(p), query.code);
    } catch (err) {
      console.error(err);
      throw new HttpError(502, "oauth_failed", "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    }
    const user = await auth.findOrCreateUser(p, profile);
    setSession(res, user, config.NODE_ENV === "production");
    res.redirect(`${config.CORS_ORIGIN}${safeNext(next)}`);
  };

  /** B42 POST /api/auth/logout — ends every session of this User on the server, then drops the cookie. */
  const logout: RequestHandler = async (req, res) => {
    if (req.user) await auth.bumpSessionVersion(req.user._id);
    clearSession(res);
    res.status(204).end();
  };

  return { start, callback, logout };
}
