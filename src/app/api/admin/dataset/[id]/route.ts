import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { getDatasetItem, isDatasetLabel, setDatasetLabel } from "@/lib/dataset-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Changes the label of one dataset row; `label: null` goes back to the imported label. */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let body: { label?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const raw = typeof body.label === "string" ? body.label.trim().toUpperCase() : null;
  if (raw && !isDatasetLabel(raw)) return NextResponse.json({ error: "Unknown label." }, { status: 422 });
  if (!setDatasetLabel(id, raw && isDatasetLabel(raw) ? raw : null)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  logAdmin(req, "dataset.relabel", String(id), raw ? `label ${raw}` : "back to the imported label");
  return NextResponse.json({ ok: true, item: getDatasetItem(id) });
}
