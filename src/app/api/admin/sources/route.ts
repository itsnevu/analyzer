import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { getSourceAdmin, listSourcesAdmin, normalizeSourceInput, saveSource } from "@/lib/sources-admin";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json({ sources: listSourcesAdmin() });
}

/** Adds a source site (origin "site"). */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const input = normalizeSourceInput(body);
  if (!input) return NextResponse.json({ error: t("Enter the web address (URL) of the site.") }, { status: 422 });
  const id = saveSource(input);
  logAdmin(req, "source.create", String(id), input.url);
  return NextResponse.json({ ok: true, source: getSourceAdmin(id) });
}
