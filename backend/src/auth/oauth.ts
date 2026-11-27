/**
 * LINE Login v2.1 and Google OpenID Connect: authorization-code flow over plain fetch.
 * Only name, email and picture are requested (SPEC).
 */
import { z } from "zod";
import type { Config } from "../config/config.js";

export type Provider = "line" | "google";

export interface OAuthProfile {
  subject: string;
  name: string;
  email?: string;
  picture?: string;
}

interface Credentials {
  clientId: string;
  clientSecret: string;
}

/** Credentials for a provider, or null when it is not configured. */
export function credentials(config: Config, provider: Provider): Credentials | null {
  const [clientId, clientSecret] =
    provider === "google" ? [config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET] : [config.LINE_CHANNEL_ID, config.LINE_CHANNEL_SECRET];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function authorizeUrl(provider: Provider, creds: Credentials, redirectUri: string, state: string): string {
  const base = provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://access.line.me/oauth2/v2.1/authorize";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    state,
    scope: provider === "google" ? "openid email profile" : "profile openid email",
  });
  return `${base}?${params}`;
}

const GoogleToken = z.object({ access_token: z.string() });
const GoogleUserInfo = z.object({ sub: z.string(), name: z.string(), email: z.string().optional(), picture: z.string().optional() });
const LineToken = z.object({ id_token: z.string() });
const LineIdToken = z.object({ sub: z.string(), name: z.string(), email: z.string().optional(), picture: z.string().optional() });

async function postForm(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** Exchanges the code and returns the User's profile. Throws on any provider error. */
export async function fetchProfile(provider: Provider, creds: Credentials, redirectUri: string, code: string): Promise<OAuthProfile> {
  const tokenRequest = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  };
  if (provider === "google") {
    const { access_token } = GoogleToken.parse(await postForm("https://oauth2.googleapis.com/token", tokenRequest));
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!res.ok) throw new Error(`google userinfo answered ${res.status}`);
    const info = GoogleUserInfo.parse(await res.json());
    return { subject: info.sub, name: info.name, email: info.email, picture: info.picture };
  }
  const { id_token } = LineToken.parse(await postForm("https://api.line.me/oauth2/v2.1/token", tokenRequest));
  // LINE verifies the ID token (signature, audience, expiry) for us.
  const info = LineIdToken.parse(await postForm("https://api.line.me/oauth2/v2.1/verify", { id_token, client_id: creds.clientId }));
  return { subject: info.sub, name: info.name, email: info.email, picture: info.picture };
}
