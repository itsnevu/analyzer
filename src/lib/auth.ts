import crypto from "node:crypto";
import { isTotpSecret, verifyTotp } from "@/lib/totp";

/**
 * Single-admin auth: a shared password (ADMIN_PASSWORD) grants a signed,
 * expiring session cookie (HMAC-SHA256 keyed with AUTH_SECRET and the
 * password, so changing either one signs everybody out).
 *
 * In development the defaults below keep the panel usable out of the box. A
 * production server refuses them: admin login stays disabled until both
 * variables are set properly (`npm run setup` generates them).
 */

const DEV_PASSWORD = "admin123";
const DEV_SECRET = "dev-insecure-secret-change-me";
const EXAMPLE_SECRET = "change-me-to-a-long-random-string";
const SESSION_DAYS = 7;

// In production the "__Host-" prefix makes browsers accept the cookie only when it is Secure, has Path=/ and no
// Domain, so a subdomain or a plain-HTTP response cannot plant or overwrite it. Development runs on plain HTTP.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60; // seconds

const production = () => process.env.NODE_ENV === "production";

/** Why admin login is unavailable, or null when it is configured. */
export function authConfigProblem(): string | null {
  if (!production()) return null;
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  if (password.length < 10 || password === DEV_PASSWORD) {
    return "ADMIN_PASSWORD is missing or too weak (use at least 10 characters).";
  }
  if (secret.length < 32 || secret === DEV_SECRET || secret === EXAMPLE_SECRET) {
    return "AUTH_SECRET is missing or too short (use a random string of at least 32 characters).";
  }
  return null;
}

/** True when the development defaults are in use (never in production). */
export function usingDevDefaults(): boolean {
  return !production() && (!process.env.ADMIN_PASSWORD || !process.env.AUTH_SECRET);
}

function password(): string {
  return process.env.ADMIN_PASSWORD || DEV_PASSWORD;
}

function signingKey(): Buffer | null {
  if (authConfigProblem()) return null;
  const secret = process.env.AUTH_SECRET || DEV_SECRET;
  const passwordHash = crypto.createHash("sha256").update(password()).digest("hex");
  return crypto.createHash("sha256").update(`${secret}:${passwordHash}`).digest();
}

function sign(payload: string, key: Buffer): string {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSession(): string {
  const key = signingKey();
  if (!key) throw new Error("Admin login is not configured.");
  const iat = Date.now();
  const exp = iat + SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, iat })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/**
 * True for a correctly signed, unexpired session. `notBefore` (ms) refuses
 * sessions issued earlier, for "sign out everywhere" (see ./session-cutoff).
 */
export function verifySession(token: string | undefined | null, notBefore = 0): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload, key);
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const { exp, iat } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp <= Date.now()) return false;
    // Tokens from before issue times were recorded count as issued at 0.
    return notBefore <= 0 || (typeof iat === "number" ? iat : 0) > notBefore;
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  if (authConfigProblem()) return false;
  // Compare digests so the comparison takes the same time whatever the input length.
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(password()).digest();
  return crypto.timingSafeEqual(a, b);
}

// --- Optional second factor: a TOTP code from an authenticator app ---

/** Base32 TOTP secret from ADMIN_TOTP_SECRET, or null when two-factor login is off (or the value is unusable). */
function totpSecret(): string | null {
  const secret = (process.env.ADMIN_TOTP_SECRET ?? "").replace(/[\s-]/g, "").toUpperCase();
  return secret && isTotpSecret(secret) ? secret : null;
}

/** True when ADMIN_TOTP_SECRET holds a valid base32 secret, so login also asks for a 6-digit code. */
export function totpEnabled(): boolean {
  return totpSecret() !== null;
}

// The newest time step a code was accepted for. A code is only accepted for a
// later step, so an observed code cannot be replayed within its window
// (RFC 6238 section 5.2). In memory: a restart forgets it, which at most lets
// the last code be reused once within its ~90 seconds.
let lastTotpStep = -1;

/** True when the code matches the current 30-second step (or one either side) and is newer than the last accepted code. */
export function checkTotp(code: string): boolean {
  const secret = totpSecret();
  if (!secret || typeof code !== "string") return false;
  const step = verifyTotp(secret, code);
  if (step === null || step <= lastTotpStep) return false;
  lastTotpStep = step;
  return true;
}
