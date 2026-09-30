import crypto from "node:crypto";

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

export const SESSION_COOKIE = "admin_session";
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
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function verifySession(token: string | undefined | null): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload, key);
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
  if (authConfigProblem()) return false;
  // Compare digests so the comparison takes the same time whatever the input length.
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(password()).digest();
  return crypto.timingSafeEqual(a, b);
}
