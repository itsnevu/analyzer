import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { logAdmin } from "@/lib/admin-log";
import { formatBytes, isSystemAction, optimizeDatabase, purgeIpsNow, rebuildSearchIndex, runBackup } from "@/lib/system";
import { revokeAllSessions } from "@/lib/session-cutoff";
import { translateError } from "@/lib/message-error";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One maintenance action at a time: a second click while one runs waits for it.
const globalForSystem = globalThis as unknown as { __hoaxMaintenance?: Promise<unknown> | null };

/**
 * Runs one maintenance action: backup | purge-ips | rebuild-index | optimize | revoke-sessions.
 * Each is logged in the activity log with its outcome. Admins only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { action } = await params;
  if (!isSystemAction(action)) return NextResponse.json({ error: t("This action is not known. Reload the page and try again.") }, { status: 404 });
  if (globalForSystem.__hoaxMaintenance) return NextResponse.json({ error: t("Another maintenance action is still running. Try again in a moment.") }, { status: 409 });

  const run = async () => {
    switch (action) {
      case "backup": {
        const r = await runBackup();
        logAdmin(req, "system.backup", r.name, formatBytes(r.bytes));
        return { ok: true, ...r, message: t("Backup saved: {name} ({size}).", { name: r.name, size: formatBytes(r.bytes) }) };
      }
      case "purge-ips": {
        const r = purgeIpsNow();
        logAdmin(req, "system.purge-ips", String(r.purged), r.retentionDays ? `retention ${r.retentionDays} days` : "retention off");
        return {
          ok: true,
          ...r,
          message: r.retentionDays === 0 ? t("IP addresses are kept without a time limit (RESEARCH_IP_RETENTION_DAYS=0), so there is nothing to clear.") : t("Cleared {count} expired IP addresses.", { count: r.purged }),
        };
      }
      case "rebuild-index": {
        const r = rebuildSearchIndex();
        logAdmin(req, "system.rebuild-index", `${r.rows} rows`, `${r.ms} ms`);
        return { ok: true, ...r, message: t("Search index rebuilt for {count} articles in {ms} ms.", { count: r.rows, ms: r.ms }) };
      }
      case "revoke-sessions": {
        // Logged first: the log entry is written while this request still counts as signed in.
        logAdmin(req, "system.revoke-sessions", "all sessions");
        revokeAllSessions();
        return { ok: true, message: t("Everyone is signed out, including you. Please sign in again.") };
      }
      case "optimize": {
        const r = optimizeDatabase();
        logAdmin(req, "system.optimize", r.vacuumed ? "vacuumed" : "skipped vacuum", `${formatBytes(r.beforeBytes)} → ${formatBytes(r.afterBytes)}, ${r.ms} ms`);
        return {
          ok: true,
          ...r,
          message: r.vacuumed
            ? t("Database optimized and compacted in {ms} ms: {before} → {after}.", { ms: r.ms, before: formatBytes(r.beforeBytes), after: formatBytes(r.afterBytes) })
            : t("Statistics refreshed. Compacting (VACUUM) was skipped because the write-ahead log is still {size}. Try again when the site is quieter.", { size: formatBytes(r.walBytes) }),
        };
      }
    }
  };

  try {
    globalForSystem.__hoaxMaintenance = run();
    return NextResponse.json(await globalForSystem.__hoaxMaintenance);
  } catch (err) {
    console.error(`[system] ${action} failed:`, err);
    return NextResponse.json({ error: err instanceof Error ? translateError(err, t) : t("The action failed.") }, { status: 500 });
  } finally {
    globalForSystem.__hoaxMaintenance = null;
  }
}
