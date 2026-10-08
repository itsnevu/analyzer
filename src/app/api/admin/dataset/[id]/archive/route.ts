import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { addDatasetRowToArchive } from "@/lib/dataset-admin";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Makes an archive entry from one dataset row, like the import script would. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  const result = addDatasetRowToArchive(id);
  if (!result.ok) return NextResponse.json({ error: t(result.error), slug: result.slug ?? null }, { status: result.status });
  logAdmin(req, "dataset.archive", String(id), `${result.slug}${result.published ? "" : " (hidden)"}`);
  return NextResponse.json(result);
}
