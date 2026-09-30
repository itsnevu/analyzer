import crypto from "node:crypto";

/**
 * Minimal single-admin auth: a shared password (ADMIN_PASSWORD) grants a
 * signed, expiring session cookie (HMAC-SHA256 with AUTH_SECRET). Good enough
 * for one admin on a self-hosted server behind HTTPS; swap for a real user
 * system + DB when you need multiple accounts.
 */

const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
const SESSION_DAYS = 7;

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60; // seconds

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSession(): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD || "admin123";
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
