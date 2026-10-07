import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { findSimilarArticles } from "./articles";
import type { ArticleListItem } from "./data";
import { getDb } from "./db";
import { reportAttachmentPath } from "./uploads";

/**
 * Contact messages and hoax reports, stored in SQLite (see ./db). Server-only.
 *
 * kind "contact": a general message (name, email, subject, message).
 * kind "report": a hoax sighting, a wrong detector result or an article
 * correction; the reported text or link is in `content`, and contact details
 * are optional.
 *
 * Admins can leave an internal `note` and mark a report as answered by one
 * fact-check (`resolvedSlug`); its title comes along when a report is read.
 */

import type { Report, ReportKind, ReportStatus, ReportType } from "./report-labels";
export { REPORT_STATUSES, REPORT_TYPES, reportNumber } from "./report-labels";
export type { Report, ReportKind, ReportStatus, ReportType } from "./report-labels";

export type NewReport = Partial<Omit<Report, "id" | "createdAt" | "status" | "readAt" | "note" | "resolvedSlug" | "resolvedTitle">> & { kind: ReportKind };

export interface ReportFilter {
  kind?: ReportKind;
  type?: ReportType;
  status?: ReportStatus;
  /** Only reports no admin has opened yet. */
  unread?: boolean;
}

export interface ReportCounts {
  total: number;
  unread: number;
  byStatus: Record<ReportStatus, number>;
}

export interface ReportChange {
  status?: ReportStatus;
  read?: boolean;
  /** Replaces the internal note; trimmed and cut at NOTE_MAX. */
  note?: string;
  /** Slug of the answering fact-check; "" clears it. The API checks the slug exists. */
  resolvedSlug?: string;
}

export const NOTE_MAX = 4000;

// The note and resolution columns were added after db.ts was frozen for this round, so they are added here, once per connection.
const prepared = new WeakSet<DatabaseSync>();

function db(): DatabaseSync {
  const conn = getDb();
  if (!prepared.has(conn)) {
    const columns = new Set(conn.prepare("PRAGMA table_info(reports)").all().map((c) => String(c.name)));
    if (!columns.has("note")) conn.exec("ALTER TABLE reports ADD COLUMN note TEXT NOT NULL DEFAULT ''");
    if (!columns.has("resolvedSlug")) conn.exec("ALTER TABLE reports ADD COLUMN resolvedSlug TEXT NOT NULL DEFAULT ''");
    prepared.add(conn);
  }
  return conn;
}

const SELECT = `SELECT r.*, COALESCE(a.title, '') AS resolvedTitle
                FROM reports r LEFT JOIN articles a ON r.resolvedSlug != '' AND a.slug = r.resolvedSlug`;

// node:sqlite rows have a null prototype; copy so they can cross to client components.
const plain = (rows: unknown[]) => rows.map((r) => ({ ...(r as object) })) as unknown as Report[];

function where(f: ReportFilter, prefix = ""): { sql: string; args: string[] } {
  const parts: string[] = [];
  const args: string[] = [];
  if (f.kind) {
    parts.push(`${prefix}kind = ?`);
    args.push(f.kind);
  }
  if (f.type) {
    parts.push(`${prefix}reportType = ?`);
    args.push(f.type);
  }
  if (f.status) {
    parts.push(`${prefix}status = ?`);
    args.push(f.status);
  }
  if (f.unread) parts.push(`${prefix}readAt IS NULL`);
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", args };
}

export async function addReport(r: NewReport): Promise<number> {
  const result = db()
    .prepare(
      `INSERT INTO reports (kind, reportType, firstName, lastName, email, subject, message, content, platform, detectedVerdict, attachment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      r.kind,
      r.reportType ?? "",
      r.firstName ?? "",
      r.lastName ?? "",
      r.email ?? "",
      r.subject ?? "",
      r.message ?? "",
      r.content ?? "",
      r.platform ?? "",
      r.detectedVerdict ?? "",
      r.attachment ?? "",
    );
  return Number(result.lastInsertRowid);
}

export async function getAllReports(): Promise<Report[]> {
  return plain(db().prepare(`${SELECT} ORDER BY r.id DESC`).all());
}

export async function listReports(filter: ReportFilter = {}): Promise<Report[]> {
  const w = where(filter, "r.");
  return plain(db().prepare(`${SELECT} ${w.sql} ORDER BY r.id DESC`).all(...w.args));
}

export async function getReport(id: number): Promise<Report | undefined> {
  const row = db().prepare(`${SELECT} WHERE r.id = ?`).get(id);
  return row ? ({ ...row } as unknown as Report) : undefined;
}

/** Totals and per-status counts, for the whole inbox or within a kind or type. */
export async function getReportCounts(filter: Pick<ReportFilter, "kind" | "type"> = {}): Promise<ReportCounts> {
  const w = where(filter);
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(readAt IS NULL), 0) AS unread,
              COALESCE(SUM(status = 'new'), 0) AS isNew, COALESCE(SUM(status = 'in-progress'), 0) AS inProgress, COALESCE(SUM(status = 'done'), 0) AS done
       FROM reports ${w.sql}`,
    )
    .get(...w.args) as Record<string, number>;
  return {
    total: Number(row.total),
    unread: Number(row.unread),
    byStatus: { new: Number(row.isNew), "in-progress": Number(row.inProgress), done: Number(row.done) },
  };
}

export async function updateReport(id: number, change: ReportChange): Promise<void> {
  const conn = db();
  if (change.status) conn.prepare("UPDATE reports SET status = ? WHERE id = ?").run(change.status, id);
  if (change.read === true) conn.prepare("UPDATE reports SET readAt = COALESCE(readAt, CURRENT_TIMESTAMP) WHERE id = ?").run(id);
  if (change.read === false) conn.prepare("UPDATE reports SET readAt = NULL WHERE id = ?").run(id);
  if (typeof change.note === "string") conn.prepare("UPDATE reports SET note = ? WHERE id = ?").run(change.note.trim().slice(0, NOTE_MAX), id);
  if (typeof change.resolvedSlug === "string") conn.prepare("UPDATE reports SET resolvedSlug = ? WHERE id = ?").run(change.resolvedSlug.trim(), id);
}

export async function deleteReport(id: number): Promise<void> {
  const report = await getReport(id);
  db().prepare("DELETE FROM reports WHERE id = ?").run(id);
  if (report?.attachment) fs.rmSync(reportAttachmentPath(report.attachment), { force: true });
}

/** Fact-checks already in the archive about what a report describes ("Find in archive"); [] for an unknown report. */
export async function findSimilarForReport(id: number, limit = 3): Promise<ArticleListItem[]> {
  const report = await getReport(id);
  if (!report) return [];
  const text = report.kind === "report" ? report.content || report.message : `${report.subject}\n${report.message}`;
  return text.trim() ? findSimilarArticles(text, limit) : [];
}
