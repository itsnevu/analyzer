import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { listHtmlTags, saveHtmlTag } from "@/lib/settings";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json({ tags: listHtmlTags() });
}

/** Adds a replacement: { tag, alt }. An existing tag gets the new replacement. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { tag?: unknown; alt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const tag = typeof body.tag === "string" ? body.tag.trim() : "";
  if (!tag) return NextResponse.json({ error: t("Enter the HTML tag.") }, { status: 422 });
  saveHtmlTag(tag, typeof body.alt === "string" ? body.alt : "");
  logAdmin(req, "settings.html-tags", tag, "added");
  return NextResponse.json({ ok: true, tags: listHtmlTags() });
}
