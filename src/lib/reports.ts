import { getDb } from "./db";

/**
 * Report / contact submissions, stored in SQLite (see ./db). Server-only.
 */

export interface Report {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  /** UTC timestamp, "YYYY-MM-DD HH:MM:SS" */
  createdAt: string;
}

export type NewReport = Omit<Report, "id" | "createdAt">;

export async function addReport(r: NewReport): Promise<void> {
  getDb()
    .prepare("INSERT INTO reports (firstName, lastName, email, subject, message) VALUES (?, ?, ?, ?, ?)")
    .run(r.firstName, r.lastName, r.email, r.subject, r.message);
}

export async function getAllReports(): Promise<Report[]> {
  const rows = getDb().prepare("SELECT * FROM reports ORDER BY id DESC").all();
  // node:sqlite rows have a null prototype; copy so they can cross to client components.
  return rows.map((r) => ({ ...r })) as unknown as Report[];
}

export async function deleteReport(id: number): Promise<void> {
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
}
