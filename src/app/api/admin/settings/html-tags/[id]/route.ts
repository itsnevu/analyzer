import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { listHtmlTags, removeHtmlTag, saveHtmlTag } from "@/lib/settings";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const idOf = async (params: Params["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

export async function PUT(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  if (!id || !listHtmlTags().some((row) => row.id === id)) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  let body: { tag?: unknown; alt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const tag = typeof body.tag === "string" ? body.tag.trim() : "";
  if (!tag) return NextResponse.json({ error: t("Enter the HTML tag.") }, { status: 422 });
  try {
    saveHtmlTag(tag, typeof body.alt === "string" ? body.alt : "", id);
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) return NextResponse.json({ error: t("This tag is already on the list. Edit that row instead.") }, { status: 409 });
    throw err;
  }
  logAdmin(req, "settings.html-tags", tag, `edited #${id}`);
  return NextResponse.json({ ok: true, tags: listHtmlTags() });
}

export async function DELETE(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  removeHtmlTag(id);
  logAdmin(req, "settings.html-tags", `#${id}`, "removed");
  return NextResponse.json({ ok: true });
}
