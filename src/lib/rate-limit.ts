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

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
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

/**
 * The visitor's address as reported by the reverse proxy in front of the app
 * (Cloudflare Tunnel, Caddy, nginx). Without a proxy these headers can be
 * forged, so run the site behind one, as DEPLOY.md describes.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || forwarded || "local";
}

/** A JSON 429 response with Retry-After. */
export function tooMany(message: string, retryAfter: number): Response {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } });
}
