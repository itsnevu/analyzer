import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { findSimilarForReport, getReport } from "@/lib/reports";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Up to three fact-checks already in the archive about what the report describes: { similar: ArticleListItem[] }. Admin only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await getReport(id))) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  return NextResponse.json({ similar: await findSimilarForReport(id, 3) });
}
