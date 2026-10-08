import { NextResponse } from "next/server";
import { getArticleBySlug, saveArticle, deleteArticle } from "@/lib/articles";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin, normalizeArticle } from "@/lib/admin-articles";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { slug } = await params;
  const article = await getArticleBySlug(slug, true);
  if (!article) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });
  return NextResponse.json({ article });
}

export async function PUT(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { slug: originalSlug } = await params;
  const existing = await getArticleBySlug(originalSlug, true);
  if (!existing) return NextResponse.json({ error: t("This item was not found. It may have been deleted already; reload the page.") }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const article = normalizeArticle(body);
  if (!article) return NextResponse.json({ error: t("The article needs a title. Fill in the title and save again.") }, { status: 422 });

  // If the slug changed, make sure the new one is free.
  if (article.slug !== originalSlug && (await getArticleBySlug(article.slug, true))) {
    return NextResponse.json({ error: t("The slug (web address) \"{slug}\" is already used by another article. Change the slug and save again.", { slug: article.slug }) }, { status: 409 });
  }
  await saveArticle(article, originalSlug);
  logAdmin(req, "article.update", article.slug, article.slug !== originalSlug ? `${article.title} (was ${originalSlug})` : article.title);
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(req: Request, { params }: Params) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const { slug } = await params;
  const existing = await getArticleBySlug(slug, true);
  await deleteArticle(slug);
  logAdmin(req, "article.delete", slug, existing?.title ?? "");
  return NextResponse.json({ ok: true });
}
