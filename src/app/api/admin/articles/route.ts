import { NextResponse } from "next/server";
import { getArticleBySlug, listArticles, saveArticle } from "@/lib/articles";
import { isAdmin, normalizeArticle } from "@/lib/admin-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const visibility = p.get("visibility");
  const result = await listArticles({
    q: p.get("q") ?? undefined,
    visibility: visibility === "public" || visibility === "hidden" ? visibility : "all",
    page: Number(p.get("page")) || 1,
    pageSize: Math.min(Number(p.get("pageSize")) || 25, 100),
  });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const article = normalizeArticle(body);
  if (!article) return NextResponse.json({ error: "Title is required." }, { status: 422 });

  if (await getArticleBySlug(article.slug, true)) {
    return NextResponse.json({ error: `Slug "${article.slug}" is already in use.` }, { status: 409 });
  }
  await saveArticle(article);
  return NextResponse.json({ ok: true, article });
}
