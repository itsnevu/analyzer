import { getDb } from "./db";
import { SESSION_COOKIE, verifySession } from "./auth";

/**
 * "Sign out everywhere": sessions issued before the cutoff stop working, so a
 * stolen or forgotten cookie can be killed without changing the password.
 * The cutoff is kept in the database (survives restarts) and cached for a few
 * seconds, since every admin request checks it. Server-only.
 */

const KEY = "sessionsValidAfter";
const CACHE_MS = 5_000;

const globalForCutoff = globalThis as unknown as { __hoaxCutoff?: { value: number; readAt: number } };

function table(): void {
  getDb().exec("CREATE TABLE IF NOT EXISTS admin_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
}

/** Milliseconds since the epoch; sessions issued earlier are refused. 0 = no cutoff. */
export function getSessionCutoff(): number {
  const cached = globalForCutoff.__hoaxCutoff;
  if (cached && Date.now() - cached.readAt < CACHE_MS) return cached.value;
  let value = 0;
  try {
    table();
    const row = getDb().prepare("SELECT value FROM admin_meta WHERE key = ?").get(KEY) as { value: string } | undefined;
    value = Number(row?.value) || 0;
  } catch (err) {
    // A database problem must not open the panel: keep the last known cutoff.
    console.error("[auth] could not read the session cutoff:", err);
    value = cached?.value ?? 0;
  }
  globalForCutoff.__hoaxCutoff = { value, readAt: Date.now() };
  return value;
}

/** Signs out every session issued until now, including the caller's. */
export function revokeAllSessions(): number {
  const now = Date.now();
  table();
  getDb().prepare("INSERT INTO admin_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(KEY, String(now));
  globalForCutoff.__hoaxCutoff = { value: now, readAt: now };
  return now;
}

/** The one check every admin gate uses: a valid, unexpired session issued after the cutoff. */
export function isAdminToken(token: string | undefined | null): boolean {
  return verifySession(token, getSessionCutoff());
}

export { SESSION_COOKIE };
