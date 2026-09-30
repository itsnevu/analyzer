import { NextResponse } from "next/server";
import { addReport, reportNumber, type NewReport, type ReportType } from "@/lib/reports";
import { notifyNewReport } from "@/lib/notify";
import { MAX_UPLOAD_BYTES, saveReportImage, UploadError } from "@/lib/uploads";
import { clientIp, take, tooMany } from "@/lib/rate-limit";
import { readClientMeta, recordUsage } from "@/lib/usage";
import { isAdmin } from "@/lib/admin-articles";

export const runtime = "nodejs";

/**
 * Intake for the Contact form (JSON) and the Report form (multipart, with an
 * optional screenshot). Both are stored for the admin at /admin/reports.
 */

const TYPES: ReportType[] = ["hoax", "wrong-result", "correction"];
const PLATFORMS = ["WhatsApp", "Facebook", "Instagram", "TikTok", "X / Twitter", "YouTube", "Telegram", "Website", "Other"];
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

type Fields = Record<string, string>;

function field(f: Fields, key: string, max: number): string {
  return (f[key] ?? "").toString().replace(/\r\n/g, "\n").trim().slice(0, max);
}

function bad(error: string, status = 422) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  for (const [key, limit, windowMs] of [[`report:${ip}`, 5, 10 * 60_000], [`report-day:${ip}`, 30, 24 * 60 * 60_000]] as const) {
    const r = take(key, limit, windowMs);
    if (!r.ok) return tooMany("Too many submissions from your network. Please try again later.", r.retryAfter);
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 200_000) return bad("The upload is too large.", 413);

  let fields: Fields = {};
  let screenshot: File | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") fields[k] = v;
        else if (k === "screenshot" && v.size > 0) screenshot = v;
      }
    } else {
      fields = Object.fromEntries(Object.entries((await req.json()) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]));
    }
  } catch {
    return bad("Invalid form data.", 400);
  }

  // Bots fill every field, people never see this one.
  if (field(fields, "website", 200)) return NextResponse.json({ ok: true, message: "Thank you." });

  const kind = fields.kind === "report" ? "report" : "contact";
  const email = field(fields, "email", 200);
  if (email && !EMAIL.test(email)) return bad("Invalid email format.");

  let report: NewReport;
  if (kind === "contact") {
    report = {
      kind,
      firstName: field(fields, "firstName", 80),
      lastName: field(fields, "lastName", 80),
      email,
      subject: field(fields, "subject", 200),
      message: field(fields, "message", 5000),
    };
    if (!report.firstName || !email || !report.subject || !report.message) {
      return bad("Name, email, subject, and message are required.");
    }
  } else {
    const reportType = TYPES.includes(fields.reportType as ReportType) ? (fields.reportType as ReportType) : "hoax";
    const platform = PLATFORMS.includes(fields.platform ?? "") ? fields.platform : "";
    report = {
      kind,
      reportType,
      platform,
      content: field(fields, "content", 10000),
      message: field(fields, "message", 5000),
      firstName: field(fields, "name", 80),
      email,
      detectedVerdict: field(fields, "detectedVerdict", 40),
      subject: field(fields, "content", 120).split("\n")[0],
    };
    if ((report.content ?? "").length < 10) return bad("Paste the message, headline or link you are reporting (at least 10 characters).");
  }

  if (screenshot) {
    try {
      report.attachment = await saveReportImage(screenshot);
    } catch (err) {
      return bad(err instanceof UploadError ? err.message : "The screenshot could not be saved.");
    }
  }

  let id: number;
  try {
    id = await addReport(report);
  } catch (err) {
    console.error("[report] failed to save:", err);
    return NextResponse.json({ error: "Failed to save. Please try again shortly." }, { status: 500 });
  }
  void notifyNewReport(id, report);
  let meta = {};
  try {
    meta = JSON.parse(fields.meta ?? "{}");
  } catch {
    /* no meta */
  }
  recordUsage(req, kind, readClientMeta(meta), { reportId: id, text: report.content || report.message }, await isAdmin());

  const number = reportNumber(id);
  return NextResponse.json({
    ok: true,
    id,
    number,
    message:
      kind === "report"
        ? `Report ${number} received. Thank you for helping fight hoaxes.`
        : "Message received. We'll get back to you by email.",
  });
}
