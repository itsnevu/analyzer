import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { getSourceAdmin, listSourcesAdmin, normalizeSourceInput, saveSource } from "@/lib/sources-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ sources: listSourcesAdmin() });
}

/** Adds a source site (origin "site"). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const input = normalizeSourceInput(body);
  if (!input) return NextResponse.json({ error: "A site URL is required." }, { status: 422 });
  const id = saveSource(input);
  logAdmin(req, "source.create", String(id), input.url);
  return NextResponse.json({ ok: true, source: getSourceAdmin(id) });
}
