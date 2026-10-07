import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { findSimilarForReport, getReport } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Up to three fact-checks already in the archive about what the report describes: { similar: ArticleListItem[] }. Admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await getReport(id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ similar: await findSimilarForReport(id, 3) });
}
