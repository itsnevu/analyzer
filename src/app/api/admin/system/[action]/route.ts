import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { logAdmin } from "@/lib/admin-log";
import { formatBytes, isSystemAction, optimizeDatabase, purgeIpsNow, rebuildSearchIndex, runBackup } from "@/lib/system";
import { revokeAllSessions } from "@/lib/session-cutoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One maintenance action at a time: a second click while one runs waits for it.
const globalForSystem = globalThis as unknown as { __hoaxMaintenance?: Promise<unknown> | null };

/**
 * Runs one maintenance action: backup | purge-ips | rebuild-index | optimize | revoke-sessions.
 * Each is logged in the activity log with its outcome. Admins only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await params;
  if (!isSystemAction(action)) return NextResponse.json({ error: "Unknown action." }, { status: 404 });
  if (globalForSystem.__hoaxMaintenance) return NextResponse.json({ error: "Another maintenance action is still running. Try again in a moment." }, { status: 409 });

  const run = async () => {
    switch (action) {
      case "backup": {
        const r = await runBackup();
        logAdmin(req, "system.backup", r.name, formatBytes(r.bytes));
        return { ok: true, ...r, message: `Backup written: ${r.name} (${formatBytes(r.bytes)}).` };
      }
      case "purge-ips": {
        const r = purgeIpsNow();
        logAdmin(req, "system.purge-ips", String(r.purged), r.retentionDays ? `retention ${r.retentionDays} days` : "retention off");
        return {
          ok: true,
          ...r,
          message: r.retentionDays === 0 ? "IP retention is unlimited (RESEARCH_IP_RETENTION_DAYS=0); nothing to clear." : `Cleared ${r.purged.toLocaleString("en-US")} expired IP addresses.`,
        };
      }
      case "rebuild-index": {
        const r = rebuildSearchIndex();
        logAdmin(req, "system.rebuild-index", `${r.rows} rows`, `${r.ms} ms`);
        return { ok: true, ...r, message: `Search index rebuilt for ${r.rows.toLocaleString("en-US")} articles in ${r.ms} ms.` };
      }
      case "revoke-sessions": {
        // Logged first: the log entry is written while this request still counts as signed in.
        logAdmin(req, "system.revoke-sessions", "all sessions");
        revokeAllSessions();
        return { ok: true, message: "Every session is signed out, including this one. Sign in again." };
      }
      case "optimize": {
        const r = optimizeDatabase();
        logAdmin(req, "system.optimize", r.vacuumed ? "vacuumed" : "skipped vacuum", `${formatBytes(r.beforeBytes)} → ${formatBytes(r.afterBytes)}, ${r.ms} ms`);
        return {
          ok: true,
          ...r,
          message: r.vacuumed
            ? `Optimized and vacuumed in ${r.ms} ms: ${formatBytes(r.beforeBytes)} → ${formatBytes(r.afterBytes)}.`
            : `Statistics refreshed; VACUUM skipped because the write-ahead log is still ${formatBytes(r.walBytes)}. Try again when the site is quieter.`,
        };
      }
    }
  };

  try {
    globalForSystem.__hoaxMaintenance = run();
    return NextResponse.json(await globalForSystem.__hoaxMaintenance);
  } catch (err) {
    console.error(`[system] ${action} failed:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "The action failed." }, { status: 500 });
  } finally {
    globalForSystem.__hoaxMaintenance = null;
  }
}
