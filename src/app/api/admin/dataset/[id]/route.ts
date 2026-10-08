import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { getDatasetItem, isDatasetLabel, setDatasetLabel } from "@/lib/dataset-admin";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Changes the label of one dataset row; `label: null` goes back to the imported label. */
export async function PATCH(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  let body: { label?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const raw = typeof body.label === "string" ? body.label.trim().toUpperCase() : null;
  if (raw && !isDatasetLabel(raw)) return NextResponse.json({ error: t("Choose one of the listed labels.") }, { status: 422 });
  if (!setDatasetLabel(id, raw && isDatasetLabel(raw) ? raw : null)) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  logAdmin(req, "dataset.relabel", String(id), raw ? `label ${raw}` : "back to the imported label");
  return NextResponse.json({ ok: true, item: getDatasetItem(id) });
}
