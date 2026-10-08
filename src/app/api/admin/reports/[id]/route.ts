import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { deleteReport, getReport, updateReport, REPORT_STATUSES, type ReportStatus } from "@/lib/reports";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function reportId(params: Params["params"]): Promise<number | null> {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Change a report's status or read state: { status?: "new" | "in-progress" | "done", read?: boolean } */
export async function PATCH(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await reportId(params);
  if (!id || !(await getReport(id))) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  let body: { status?: string; read?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const status = body.status && body.status in REPORT_STATUSES ? (body.status as ReportStatus) : undefined;
  if (body.status && !status) return NextResponse.json({ error: t("Choose one of the listed statuses.") }, { status: 422 });
  await updateReport(id, { status, read: typeof body.read === "boolean" ? body.read : undefined });
  if (status) logAdmin(req, "report.update", String(id), `status ${status}`);
  return NextResponse.json({ ok: true, report: await getReport(id) });
}

export async function DELETE(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await reportId(params);
  if (!id) return NextResponse.json({ error: t("The item number is not valid. Reload the page and try again.") }, { status: 400 });
  await deleteReport(id);
  logAdmin(req, "report.delete", String(id));
  return NextResponse.json({ ok: true });
}
