import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { deleteReport, getReport, updateReport, REPORT_STATUSES, type ReportStatus } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function reportId(params: Params["params"]): Promise<number | null> {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Change a report's status or read state: { status?: "new" | "in-progress" | "done", read?: boolean } */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await reportId(params);
  if (!id || !(await getReport(id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let body: { status?: string; read?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const status = body.status && body.status in REPORT_STATUSES ? (body.status as ReportStatus) : undefined;
  if (body.status && !status) return NextResponse.json({ error: "Unknown status." }, { status: 422 });
  await updateReport(id, { status, read: typeof body.read === "boolean" ? body.read : undefined });
  return NextResponse.json({ ok: true, report: await getReport(id) });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await reportId(params);
  if (!id) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
