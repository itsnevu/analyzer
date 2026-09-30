import fs from "node:fs";
import { getDb } from "./db";
import { reportAttachmentPath } from "./uploads";

/**
 * Contact messages and hoax reports, stored in SQLite (see ./db). Server-only.
 *
 * kind "contact": a general message (name, email, subject, message).
 * kind "report": a hoax sighting, a wrong detector result or an article
 * correction; the reported text or link is in `content`, and contact details
 * are optional.
 */

import type { Report, ReportKind, ReportStatus } from "./report-labels";
export { REPORT_STATUSES, REPORT_TYPES, reportNumber } from "./report-labels";
export type { Report, ReportKind, ReportStatus, ReportType } from "./report-labels";

export type NewReport = Partial<Omit<Report, "id" | "createdAt" | "status" | "readAt">> & { kind: ReportKind };

// node:sqlite rows have a null prototype; copy so they can cross to client components.
const plain = (rows: unknown[]) => rows.map((r) => ({ ...(r as object) })) as unknown as Report[];

export async function addReport(r: NewReport): Promise<number> {
  const result = getDb()
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
  return plain(getDb().prepare("SELECT * FROM reports ORDER BY id DESC").all());
}

export async function listReports(filter: { kind?: ReportKind; status?: ReportStatus } = {}): Promise<Report[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.kind) (where.push("kind = ?"), params.push(filter.kind));
  if (filter.status) (where.push("status = ?"), params.push(filter.status));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return plain(getDb().prepare(`SELECT * FROM reports ${clause} ORDER BY id DESC`).all(...params));
}

export async function getReport(id: number): Promise<Report | undefined> {
  const row = getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id);
  return row ? ({ ...row } as unknown as Report) : undefined;
}

export async function getReportCounts(): Promise<{ total: number; unread: number }> {
  const row = getDb().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(readAt IS NULL), 0) AS unread FROM reports").get() as {
    total: number;
    unread: number;
  };
  return { total: Number(row.total), unread: Number(row.unread) };
}

export async function updateReport(id: number, change: { status?: ReportStatus; read?: boolean }): Promise<void> {
  const db = getDb();
  if (change.status) db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(change.status, id);
  if (change.read === true) db.prepare("UPDATE reports SET readAt = COALESCE(readAt, CURRENT_TIMESTAMP) WHERE id = ?").run(id);
  if (change.read === false) db.prepare("UPDATE reports SET readAt = NULL WHERE id = ?").run(id);
}

export async function deleteReport(id: number): Promise<void> {
  const report = await getReport(id);
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
  if (report?.attachment) fs.rmSync(reportAttachmentPath(report.attachment), { force: true });
}
