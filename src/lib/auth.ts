// Server-only HMAC-signed cookie sessions.
// Two scopes:
//   - manager:<recordId>   set after Employee ID verification
//   - admin                set after admin password login

import "server-only";
import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

if (!SECRET) {
  // Don't crash module load on Vercel build — just warn at runtime when used.
  // verifySession / signSession will refuse to operate without a secret.
}

export type Session = { scope: string; expiresAt: number };

export function signSession(session: Session): string {
  if (!SECRET) throw new Error("SESSION_SECRET not configured");
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!SECRET || !token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  // Constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof s.expiresAt !== "number" || s.expiresAt < Date.now()) return null;
    if (typeof s.scope !== "string" || !s.scope) return null;
    return s;
  } catch {
    return null;
  }
}

export function newSession(scope: string): { token: string; maxAge: number; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return { token: signSession({ scope, expiresAt }), maxAge: SESSION_TTL_MS / 1000, expiresAt };
}

export const COOKIE_NAME = "mlg_session";

// secure: true only in production. Local dev over HTTP would otherwise have the
// browser silently drop the cookie.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
