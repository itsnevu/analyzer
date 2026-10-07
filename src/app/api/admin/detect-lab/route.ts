import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { LabError, parseLabRequest, runLab } from "@/lib/detect-lab";
import { PageError } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scores a text against the archive with one similarity method. Admin only; never logged. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const request = parseLabRequest(body);
  if (!request) return NextResponse.json({ error: "Paste a text or a link and choose a method." }, { status: 422 });

  try {
    return NextResponse.json(await runLab(request));
  } catch (err) {
    if (err instanceof LabError || err instanceof PageError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[detect-lab] failed:", err);
    return NextResponse.json({ error: "The lab run failed. See the server log." }, { status: 500 });
  }
}
