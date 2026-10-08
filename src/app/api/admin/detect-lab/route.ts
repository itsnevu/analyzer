import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { LabError, parseLabRequest, runLab } from "@/lib/detect-lab";
import { PageError } from "@/lib/fetch-page";
import { translateError } from "@/lib/message-error";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scores a text against the archive with one similarity method. Admin only; never logged. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const request = parseLabRequest(body);
  if (!request) return NextResponse.json({ error: t("Paste a text or a link and choose a method.") }, { status: 422 });

  try {
    return NextResponse.json(await runLab(request));
  } catch (err) {
    if (err instanceof LabError || err instanceof PageError) return NextResponse.json({ error: translateError(err, t) }, { status: 422 });
    console.error("[detect-lab] failed:", err);
    return NextResponse.json({ error: t("The test run failed because of a problem on the server. Try again; if it keeps failing, check the server log.") }, { status: 500 });
  }
}
