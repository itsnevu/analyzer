import { getDb } from "./db";
import { clientIp } from "./rate-limit";

/**
 * Activity log of the admin panel (/admin/activity): what was changed, when
 * and from which address. Kept apart from the research log (./usage), which
 * records visitors, not the editor. `logAdmin` never throws, so a failed log
 * line cannot break the action it records. Server-only.
 */

/** Labels for the action keys the routes write; an unknown key is shown as is. */
export const ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  "article.create": "Article created",
  "article.update": "Article updated",
  "article.delete": "Article deleted",
  "article.bulk": "Bulk article action",
  review: "Review decision",
  "dataset.relabel": "Dataset row relabeled",
  "dataset.archive": "Dataset row added to archive",
  "settings.stopwords": "Stopwords changed",
  "settings.html-tags": "HTML tag replacement changed",
  "settings.skip-domains": "Skipped domains changed",
  "source.create": "Source added",
  "source.update": "Source edited",
  "source.delete": "Source deleted",
  "model.train": "Model trained",
  "report.update": "Report status changed",
  "report.delete": "Report deleted",
  "system.backup": "Database backed up",
  "system.purge-ips": "Expired IPs purged",
  "system.rebuild-index": "Search index rebuilt",
  "system.optimize": "Database optimized",
  "activity.clear": "Old activity entries cleared",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const clip = (v: unknown, max: number) => (v === undefined || v === null ? "" : String(v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max));

/**
 * Writes one line. `req` gives the address (null for jobs without a request).
 * `target` is what was acted on (a slug, an id); `detail` says how.
 */
export function logAdmin(req: Request | null, action: string, target: unknown = "", detail: unknown = ""): void {
  try {
    let ip = "";
    if (req) {
      try {
        ip = clientIp(req);
      } catch {
        ip = "";
      }
    }
    getDb()
      .prepare("INSERT INTO admin_log (at, action, target, detail, ip) VALUES (?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), clip(action, 60) || "unknown", clip(target, 200), clip(detail, 2000), clip(ip, 60));
  } catch (err) {
    console.error("[admin-log] could not record:", err);
  }
}

/* --------------------------------------------------------------- reads */

export interface AdminLogEntry {
  id: number;
  at: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

export interface AdminLogFilter {
  action?: string;
  /** YYYY-MM-DD, inclusive */
  from?: string;
  /** YYYY-MM-DD, inclusive */
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminLogPage {
  items: AdminLogEntry[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function whereSql(f: AdminLogFilter): { sql: string; args: string[] } {
  const parts: string[] = [];
  const args: string[] = [];
  if (f.action) {
    parts.push("action = ?");
    args.push(f.action);
  }
  if (f.from && DATE.test(f.from)) {
    parts.push("at >= ?");
    args.push(f.from);
  }
  if (f.to && DATE.test(f.to)) {
    parts.push("at < date(?, '+1 day')");
    args.push(f.to);
  }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", args };
}

/** Reads the filter from query parameters (page, API and export share it). */
export function adminLogFilterFrom(get: (key: string) => string | undefined): AdminLogFilter {
  const date = (s: string | undefined) => (s && DATE.test(s) ? s : undefined);
  return {
    action: (get("action") ?? "").trim().slice(0, 60) || undefined,
    from: date(get("from")),
    to: date(get("to")),
    page: Number(get("page")) || 1,
  };
}

export function listAdminLog(f: AdminLogFilter = {}): AdminLogPage {
  const db = getDb();
  const pageSize = Math.min(Math.max(f.pageSize ?? 100, 1), 500);
  const { sql, args } = whereSql(f);
  const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM admin_log ${sql}`).get(...args) as { n: number };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(f.page ?? 1) || 1, 1), pages);
  const rows = db
    .prepare(`SELECT id, at, action, target, detail, ip FROM admin_log ${sql} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize) as unknown as AdminLogEntry[];
  return { items: rows.map((r) => ({ ...r })), total, page, pages, pageSize };
}

/** Every action that occurs in the log, with how often, most frequent first. */
export function adminLogActions(): { action: string; count: number }[] {
  const rows = getDb().prepare("SELECT action, COUNT(*) AS count FROM admin_log GROUP BY action ORDER BY count DESC, action").all();
  return rows.map((r) => ({ action: String(r.action), count: Number(r.count) }));
}

/** The filtered log as CSV, oldest first. */
export function* adminLogCsv(f: AdminLogFilter = {}): Generator<string> {
  const cols = ["id", "at", "action", "label", "target", "detail", "ip"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  yield "﻿" + cols.join(",") + "\n";
  const { sql, args } = whereSql(f);
  const rows = getDb().prepare(`SELECT id, at, action, target, detail, ip FROM admin_log ${sql} ORDER BY at, id`).iterate(...args) as Iterable<AdminLogEntry>;
  for (const r of rows) yield cols.map((c) => cell(c === "label" ? actionLabel(r.action) : r[c as keyof AdminLogEntry])).join(",") + "\n";
}

/** Deletes entries older than `days` (at least 1); returns how many went. */
export function clearAdminLog(days = 90): number {
  const d = Math.max(1, Math.floor(days));
  const cutoff = new Date(Date.now() - d * 86_400_000).toISOString();
  return Number(getDb().prepare("DELETE FROM admin_log WHERE at < ?").run(cutoff).changes);
}
