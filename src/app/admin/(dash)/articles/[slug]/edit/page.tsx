import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/articles";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug, true);
  if (!article) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/articles" className="text-sm text-ink-muted hover:text-ink">← Articles</Link>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">Edit Article</h1>
        </div>
        {article.published && (
          <Link href={`/blog/${article.slug}`} target="_blank" className="neu-btn px-4 py-2 text-sm">
            View on site ↗
          </Link>
        )}
      </div>
      <ArticleForm mode="edit" initial={article} />
    </div>
  );
}
