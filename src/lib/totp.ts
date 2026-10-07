import crypto from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP, HMAC-SHA1, 6
 * digits, 30-second steps): the second factor of the admin login. Secrets are
 * base32 strings (RFC 4648), the format authenticator apps and otpauth:// URLs
 * use. Only Node built-ins. Server-only.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, upper case, without padding. */
export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

/** Accepts either case, spaces and dashes (as apps print them) and optional "=" padding. Throws on other characters. */
export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = BASE32.indexOf(ch);
    if (value < 0) throw new Error(`Invalid base32 character "${ch}".`);
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
      buffer &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/** True when the text is base32 for at least 80 bits of secret (RFC 4226 §4 asks for 128; apps accept 80). */
export function isTotpSecret(text: string): boolean {
  try {
    return base32Decode(text).length >= 10;
  } catch {
    return false;
  }
}

/** HOTP (RFC 4226): HMAC-SHA1 of the 8-byte big-endian counter, dynamically truncated to `digits` decimal digits. */
export function hotp(secret: Uint8Array, counter: number, digits = 6): string {
  if (!Number.isInteger(counter) || counter < 0) throw new RangeError("The HOTP counter must be a non-negative integer.");
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter % 2 ** 32, 4);
  const mac = crypto.createHmac("sha1", Buffer.from(secret)).update(message).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The code for a moment in time. `time` is Unix seconds (RFC 6238 counts steps of `step` seconds from the epoch). */
export function totp(secret: string, time: number, step = 30, digits = 6): string {
  return hotp(base32Decode(secret), Math.floor(time / step), digits);
}

/**
 * Checks a code against the current step and `window` steps either side (one
 * step each way absorbs clock drift between phone and server). Every candidate
 * is compared in constant time and all of them are always compared. Returns the
 * step the code belongs to, so the caller can refuse a second use of the same
 * code (RFC 6238 §5.2), or null when it matches none.
 */
export function verifyTotp(secret: string, code: string, window = 1, now = Math.floor(Date.now() / 1000), step = 30, digits = 6): number | null {
  const given = code.replace(/\s+/g, "");
  if (given.length !== digits || !/^\d+$/.test(given)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(now / step);
  const givenBuffer = Buffer.from(given);
  let matched: number | null = null;
  for (let offset = -window; offset <= window; offset++) {
    const candidate = current + offset;
    if (candidate < 0) continue;
    const ok = crypto.timingSafeEqual(Buffer.from(hotp(key, candidate, digits)), givenBuffer);
    if (ok && matched === null) matched = candidate;
  }
  return matched;
}

/** 20 random bytes (160 bits, RFC 4226's recommendation) as a 32-character base32 string. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** The Key URI that authenticator apps scan or accept pasted. Defaults (SHA1, 6 digits, 30 s) are the apps' defaults, so they are left out. */
export function otpauthUrl(secret: string, issuer: string, account: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
