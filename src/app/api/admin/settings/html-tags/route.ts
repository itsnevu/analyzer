import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { listHtmlTags, saveHtmlTag } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tags: listHtmlTags() });
}

/** Adds a replacement: { tag, alt }. An existing tag gets the new replacement. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { tag?: unknown; alt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const tag = typeof body.tag === "string" ? body.tag.trim() : "";
  if (!tag) return NextResponse.json({ error: "The tag is required." }, { status: 422 });
  saveHtmlTag(tag, typeof body.alt === "string" ? body.alt : "");
  logAdmin(req, "settings.html-tags", tag, "added");
  return NextResponse.json({ ok: true, tags: listHtmlTags() });
}
