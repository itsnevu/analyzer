import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { panelDb } from "@/lib/legacy-panel";
import { listSkipDomains, normalizeDomain, removeSkipDomain } from "@/lib/settings";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const idOf = async (params: Params["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

/** Changes a domain or its note: { domain: "example.com" | "https://www.example.com/page", note? } */
export async function PUT(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  let body: { domain?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : "");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ error: t("That is not a valid domain. Enter it like example.com.") }, { status: 422 });
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";
  try {
    const r = panelDb().prepare("UPDATE skip_domains SET domain = ?, note = ? WHERE id = ?").run(domain, note, id);
    if (!Number(r.changes)) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) return NextResponse.json({ error: t("That domain is already on the list.") }, { status: 409 });
    throw err;
  }
  logAdmin(req, "settings.skip-domains", domain, "edited");
  return NextResponse.json({ ok: true, domains: listSkipDomains() });
}

export async function DELETE(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  removeSkipDomain(id);
  logAdmin(req, "settings.skip-domains", `#${id}`, "removed");
  return NextResponse.json({ ok: true });
}
