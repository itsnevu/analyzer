/**
 * Fixed-window request counters, kept in memory. The site runs as one Node
 * process, so this is enough to slow down scripted abuse; counts reset when
 * the server restarts. Server-only.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForLimits = globalThis as unknown as { __hoaxLimits?: Map<string, Bucket> };
const buckets = (globalForLimits.__hoaxLimits ??= new Map());

const MAX_BUCKETS = 50_000;
let lastPrune = 0;

/** Drops expired counters now and then (not on every request), and the oldest ones if the map still grows too big. */
function prune(now: number) {
  if (buckets.size < 5000 || now - lastPrune < 10_000) return;
  lastPrune = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  // Map order is insertion order, so the first keys are the oldest.
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

export interface LimitResult {
  ok: boolean;
  /** Seconds until the window resets; 0 when the request is allowed. */
  retryAfter: number;
}

/** Counts one request against `key`; refuses once `limit` requests happened in the current window. */
export function take(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  prune(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Whether `key` is already over `limit`, without counting a request. */
export function isBlocked(key: string, limit: number): LimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now || b.count < limit) return { ok: true, retryAfter: 0 };
  return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function reset(key: string): void {
  buckets.delete(key);
}

/** Gives back one request counted by `take` (for an attempt that turned out not to count). */
export function refund(key: string): void {
  const b = buckets.get(key);
  if (b && b.count > 0) b.count--;
}

const TRUSTED = ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"] as const;

/**
 * The visitor's address as reported by the reverse proxy in front of the app.
 * Set TRUSTED_IP_HEADER to the one header your proxy writes, so a visitor
 * cannot pick their own address by sending the others:
 *   cf-connecting-ip  Cloudflare Tunnel (the default)
 *   x-forwarded-for   Caddy or nginx (the last entry, the one the proxy added, is used)
 *   x-real-ip         nginx with proxy_set_header X-Real-IP
 * Without a proxy these headers can be forged, so run the site behind one, as DEPLOY.md describes.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const chosen = (process.env.TRUSTED_IP_HEADER ?? "cf-connecting-ip").trim().toLowerCase();
  const header = (TRUSTED as readonly string[]).includes(chosen) ? chosen : "cf-connecting-ip";
  const raw = h.get(header) ?? "";
  const value = header === "x-forwarded-for" ? raw.split(",").pop() : raw;
  return value?.trim() || "local";
}

/**
 * The key rate limits count against: the client address, with an IPv6 address
 * cut to its /64, since one connection usually gets a whole /64 and could
 * otherwise rotate through addresses to escape every limit.
 */
export function limitKey(req: Request): string {
  const ip = clientIp(req);
  if (!ip.includes(":") || ip.startsWith("::ffff:")) return ip;
  // Expand "::" so the first four groups are the network part.
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/** A JSON 429 response with Retry-After. */
export function tooMany(message: string, retryAfter: number): Response {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } });
}
