import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { dismissAttention, restoreAttention } from "@/lib/attention";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readKey(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { key?: unknown };
    return typeof body.key === "string" && /^[0-9a-f]{16}$/.test(body.key) ? body.key : null;
  } catch {
    return null;
  }
}

/** Hides an unmatched group: { key } as listed by /api/admin/attention. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const key = await readKey(req);
  if (!key) return NextResponse.json({ error: t("This item could not be identified. Reload the page and try again.") }, { status: 422 });
  dismissAttention(key);
  return NextResponse.json({ ok: true, key });
}

/** Brings a dismissed group back: { key }. */
export async function DELETE(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const key = await readKey(req);
  if (!key) return NextResponse.json({ error: t("This item could not be identified. Reload the page and try again.") }, { status: 422 });
  if (!restoreAttention(key)) return NextResponse.json({ error: t("This group is not hidden, so there is nothing to bring back.") }, { status: 404 });
  return NextResponse.json({ ok: true, key });
}
