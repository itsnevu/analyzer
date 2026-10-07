import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { removeSkipDomain } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  removeSkipDomain(id);
  return NextResponse.json({ ok: true });
}
