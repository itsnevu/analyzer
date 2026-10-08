import { NextResponse } from "next/server";
import { findSimilarArticles } from "@/lib/articles";
import { isAdmin } from "@/lib/admin-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/articles/similar?text=…&exclude=<slug>&limit=5
 * Published archive entries about the same claim, so the editor can warn about duplicates.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const text = (p.get("text") ?? "").trim().slice(0, 4000);
  if (text.length < 8) return NextResponse.json({ error: "Write a title or the claim first." }, { status: 400 });
  const exclude = (p.get("exclude") ?? "").trim() || undefined;
  const limit = Math.min(10, Math.max(1, Number.parseInt(p.get("limit") ?? "", 10) || 5));
  try {
    const items = await findSimilarArticles(text, limit, exclude);
    return NextResponse.json({ items: items.map((item) => ({ ...item })) });
  } catch (err) {
    console.error("[admin] similar articles failed:", err);
    return NextResponse.json({ error: "The archive search failed." }, { status: 500 });
  }
}
