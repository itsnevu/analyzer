import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { isReviewAction, listReviewQueue, reviewArticle } from "@/lib/review";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The hidden articles waiting for a verdict. Admin only. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json(await listReviewQueue());
}

/** Applies a decision: { slug, action: "hoax" | "misleading" | "valid" | "delete" }. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { slug?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug || !isReviewAction(body.action)) return NextResponse.json({ error: t("Choose an article and a decision.") }, { status: 422 });

  const done = await reviewArticle(slug, body.action);
  if (!done) return NextResponse.json({ error: t("That article no longer exists. It may have been deleted.") }, { status: 404 });
  logAdmin(req, "review", slug, body.action);
  const { total } = await listReviewQueue(1);
  return NextResponse.json({ ok: true, action: body.action, remaining: total });
}
