import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { addDatasetRowToArchive } from "@/lib/dataset-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Makes an archive entry from one dataset row, like the import script would. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const result = addDatasetRowToArchive(id);
  if (!result.ok) return NextResponse.json({ error: result.error, slug: result.slug ?? null }, { status: result.status });
  return NextResponse.json(result);
}
