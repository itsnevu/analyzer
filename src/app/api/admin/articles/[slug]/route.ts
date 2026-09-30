import { NextResponse } from "next/server";
import { getArticleBySlug, saveArticle, deleteArticle } from "@/lib/articles";
import { isAdmin, normalizeArticle } from "@/lib/admin-articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const article = await getArticleBySlug(slug, true);
  if (!article) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ article });
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug: originalSlug } = await params;
  const existing = await getArticleBySlug(originalSlug, true);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const article = normalizeArticle(body);
  if (!article) return NextResponse.json({ error: "Title is required." }, { status: 422 });

  // If the slug changed, make sure the new one is free.
  if (article.slug !== originalSlug && (await getArticleBySlug(article.slug, true))) {
    return NextResponse.json({ error: `Slug "${article.slug}" is already in use.` }, { status: 409 });
  }
  await saveArticle(article, originalSlug);
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  await deleteArticle(slug);
  return NextResponse.json({ ok: true });
}
