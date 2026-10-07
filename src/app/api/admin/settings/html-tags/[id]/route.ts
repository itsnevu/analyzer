import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { listHtmlTags, removeHtmlTag, saveHtmlTag } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const idOf = async (params: Params["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idOf(params);
  if (!id || !listHtmlTags().some((t) => t.id === id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let body: { tag?: unknown; alt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const tag = typeof body.tag === "string" ? body.tag.trim() : "";
  if (!tag) return NextResponse.json({ error: "The tag is required." }, { status: 422 });
  try {
    saveHtmlTag(tag, typeof body.alt === "string" ? body.alt : "", id);
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) return NextResponse.json({ error: "Another row already has this tag." }, { status: 409 });
    throw err;
  }
  return NextResponse.json({ ok: true, tags: listHtmlTags() });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  removeHtmlTag(id);
  return NextResponse.json({ ok: true });
}
