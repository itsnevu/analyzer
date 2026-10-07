import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { isReviewAction, listReviewQueue, reviewArticle } from "@/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The hidden articles waiting for a verdict. Admin only. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listReviewQueue());
}

/** Applies a decision: { slug, action: "hoax" | "misleading" | "valid" | "delete" }. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { slug?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug || !isReviewAction(body.action)) return NextResponse.json({ error: "slug and a valid action are required." }, { status: 422 });

  const done = await reviewArticle(slug, body.action);
  if (!done) return NextResponse.json({ error: "No such article." }, { status: 404 });
  logAdmin(req, "review", slug, body.action);
  const { total } = await listReviewQueue(1);
  return NextResponse.json({ ok: true, action: body.action, remaining: total });
}
