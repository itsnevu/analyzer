import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/articles";
import { getAdminT } from "@/lib/admin-lang-server";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Edit article") };
}

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { t } = await getAdminT();
  const { slug } = await params;
  const article = await getArticleBySlug(slug, true);
  if (!article) notFound();

  return (
    <div>
      <AdminPageHeader
        title={t("Edit article")}
        description={
          <>
            {t("Change what you need and press Save. The preview shows how it will look on the site.")}{" "}
            <span className="whitespace-nowrap font-mono text-xs">/blog/{article.slug}</span>
            {!article.published && <span className="whitespace-nowrap"> · {t("Hidden from the site")}</span>}
          </>
        }
        actions={
          <>
            <Link href="/admin/articles" className="neu-btn px-4 py-2 text-sm">
              {t("← Articles")}
            </Link>
            {article.published && (
              <Link href={`/blog/${article.slug}`} target="_blank" className="neu-btn px-4 py-2 text-sm">
                {t("View on site ↗")}
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
