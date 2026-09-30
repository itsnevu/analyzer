import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { deleteReport } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authed(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
