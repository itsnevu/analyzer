import { NextResponse } from "next/server";
import { adminArticleFilterFrom, getArticleBySlug, listArticles, saveArticle } from "@/lib/articles";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin, normalizeArticle } from "@/lib/admin-articles";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  // Same parameters as /admin/articles: q, verdict, lang, source, year, text, visibility, sort, order, page, pageSize.
  const p = new URL(req.url).searchParams;
  const result = await listArticles(adminArticleFilterFrom((k) => p.get(k) ?? undefined));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const article = normalizeArticle(body);
  if (!article) return NextResponse.json({ error: t("The article needs a title. Fill in the title and save again.") }, { status: 422 });

  if (await getArticleBySlug(article.slug, true)) {
    return NextResponse.json({ error: t("The slug (web address) \"{slug}\" is already used by another article. Change the slug and save again.", { slug: article.slug }) }, { status: 409 });
  }
  await saveArticle(article);
  logAdmin(req, "article.create", article.slug, article.title);
  return NextResponse.json({ ok: true, article });
}
