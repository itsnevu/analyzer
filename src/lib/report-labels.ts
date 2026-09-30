/** Report types, labels and numbering. Safe for client code; storage lives in ./reports. */

export type ReportKind = "contact" | "report";
export type ReportType = "hoax" | "wrong-result" | "correction";
export type ReportStatus = "new" | "in-progress" | "done";

export const REPORT_TYPES: Record<ReportType, string> = {
  hoax: "Hoax sighting",
  "wrong-result": "Wrong detector result",
  correction: "Article correction",
};

export const REPORT_STATUSES: Record<ReportStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  done: "Done",
};

export interface Report {
  id: number;
  kind: ReportKind;
  reportType: ReportType | "";
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  content: string;
  platform: string;
  detectedVerdict: string;
  attachment: string;
  status: ReportStatus;
  /** UTC timestamp, or null while unread */
  readAt: string | null;
  /** UTC timestamp, "YYYY-MM-DD HH:MM:SS" */
  createdAt: string;
}

/** Public reference shown to the person who sent it, e.g. "R-00042". */
export function reportNumber(id: number): string {
  return `R-${String(id).padStart(5, "0")}`;
}

/** sessionStorage key for a report the detector pre-fills ("This result is wrong"). */
export const REPORT_DRAFT_KEY = "hoax-analyzer:report-draft";

export interface ReportDraft {
  reportType: ReportType;
  content: string;
  detectedVerdict?: string;
}
