import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { deleteSearch } from "@/lib/searches";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !deleteSearch(id)) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  return NextResponse.json({ ok: true });
}
