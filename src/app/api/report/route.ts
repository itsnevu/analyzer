import { NextResponse } from "next/server";
import { addReport } from "@/lib/reports";

export const runtime = "nodejs";

/**
 * Report / Contact intake.
 *
 * The legacy WordPress site used a plain contact form that emailed
 * syyhoaxanalyzer@gmail.com. Submissions are validated and stored in the
 * database; the admin reads them at /admin/reports.
 */
export async function POST(req: Request) {
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { firstName, email, subject, message } = body;
  if (!firstName || !email || !subject || !message) {
    return NextResponse.json(
      { error: "Name, email, subject, and message are required." },
      { status: 422 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 422 });
  }

  try {
    await addReport({
      firstName: String(firstName).trim(),
      lastName: String(body.lastName ?? "").trim(),
      email: String(email).trim(),
      subject: String(subject).trim(),
      message: String(message).trim(),
    });
  } catch (err) {
    console.error("[report] failed to save:", err);
    return NextResponse.json({ error: "Failed to save the report. Please try again shortly." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Report received. Thank you for helping fight hoaxes.",
  });
}
