import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { deleteSource, getCrawlQueue, getSourceAdmin, normalizeSourceInput, saveSource } from "@/lib/sources-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const idOf = async (params: Params["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : 0;
};

/** One source with the listing pages the old crawler used for it. */
export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idOf(params);
  const source = id ? getSourceAdmin(id) : null;
  if (!source) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ source, crawlQueue: getCrawlQueue(id) });
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idOf(params);
  if (!id || !getSourceAdmin(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const input = normalizeSourceInput(body);
  if (!input) return NextResponse.json({ error: "A site URL is required." }, { status: 422 });
  saveSource(input, id);
  return NextResponse.json({ ok: true, source: getSourceAdmin(id) });
}

/** Removes a source added here; legacy rows stay (set them inactive instead). */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idOf(params);
  const result = id ? deleteSource(id) : "missing";
  if (result === "missing") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (result === "legacy") return NextResponse.json({ error: "Legacy sources cannot be deleted. Set the source inactive instead." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
