import nodemailer from "nodemailer";
import { REPORT_TYPES, reportNumber, type Report } from "./reports";
import { SITE_URL } from "./site";

/**
 * Tells the admin about a new report or message, through whichever channels
 * are configured (see .env.local.example). Never throws: a failed
 * notification must not lose the report, which is already saved. Server-only.
 */

function summary(id: number, r: Partial<Report>): { subject: string; text: string } {
  const what = r.kind === "report" ? REPORT_TYPES[r.reportType as keyof typeof REPORT_TYPES] ?? "Report" : "Contact message";
  const from = [r.firstName, r.lastName].filter(Boolean).join(" ") || "anonymous";
  const body = (r.kind === "report" ? r.content : r.message) ?? "";
  const header = [
    `${what} ${reportNumber(id)} from ${from}${r.email ? ` <${r.email}>` : ""}`,
    r.subject && `Subject: ${r.subject}`,
    r.platform && `Seen on: ${r.platform}`,
    r.detectedVerdict && `Detector said: ${r.detectedVerdict}`,
  ]
    .filter(Boolean)
    .join("\n");
  const excerpt = body.length > 600 ? `${body.slice(0, 600)}…` : body;
  return { subject: `[Hoax Analyzer] ${what} ${reportNumber(id)}`, text: `${header}\n\n${excerpt}\n\n${SITE_URL}/admin/reports` };
}

async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
}

async function email(subject: string, text: string) {
  const url = process.env.SMTP_URL;
  const to = process.env.REPORT_NOTIFY_EMAIL;
  if (!url || !to) return;
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from: to, to, subject, text });
}

export async function notifyNewReport(id: number, report: Partial<Report>): Promise<void> {
  const { subject, text } = summary(id, report);
  const results = await Promise.allSettled([telegram(text), email(subject, text)]);
  for (const r of results) if (r.status === "rejected") console.error("[notify] failed:", r.reason);
}
