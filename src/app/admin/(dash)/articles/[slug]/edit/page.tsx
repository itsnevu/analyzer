import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/articles";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const article = await getArticleBySlug(slug, true);
  if (!article) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit article"
        description={
          <>
            <span className="font-mono text-xs">/blog/{article.slug}</span>
            {article.published ? "" : " · hidden from the site"}
          </>
        }
        actions={
          <>
            <Link href="/admin/articles" className="neu-btn px-4 py-2 text-sm">
              ← Articles
            </Link>
            {article.published && (
              <Link href={`/blog/${article.slug}`} target="_blank" className="neu-btn px-4 py-2 text-sm">
                View on site ↗
              </Link>
            )}
          </>
        }
      />
      {/* Keyed by slug so a rename (which moves to the new URL) starts a fresh form. */}
      <ArticleForm key={article.slug} mode="edit" initial={{ ...article }} />
    </div>
  );
}
