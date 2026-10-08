import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { deleteSource, getCrawlQueue, getSourceAdmin, normalizeSourceInput, saveSource } from "@/lib/sources-admin";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const idOf = async (params: Params["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

/** One source with the listing pages the old crawler used for it. */
export async function GET(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  const source = id ? getSourceAdmin(id) : null;
  if (!source) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  return NextResponse.json({ source, crawlQueue: getCrawlQueue(id) });
}

export async function PUT(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  if (!id || !getSourceAdmin(id)) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const input = normalizeSourceInput(body);
  if (!input) return NextResponse.json({ error: t("Enter the web address (URL) of the site.") }, { status: 422 });
  saveSource(input, id);
  logAdmin(req, "source.update", String(id), `${input.url}${input.active ? "" : " (inactive)"}`);
  return NextResponse.json({ ok: true, source: getSourceAdmin(id) });
}

/** Removes a source added here; legacy rows stay (set them inactive instead). */
export async function DELETE(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  const result = id ? deleteSource(id) : "missing";
  if (result === "missing") return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  if (result === "legacy") return NextResponse.json({ error: t("Sources from the old panel cannot be deleted. Set the source to inactive instead.") }, { status: 409 });
  logAdmin(req, "source.delete", String(id));
  return NextResponse.json({ ok: true });
}
