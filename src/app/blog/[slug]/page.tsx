import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleLayout } from "@/components/article/ArticleLayout";
import { findSimilarArticles, getArticleBySlug } from "@/lib/articles";
import { breadcrumbJsonLd, claimReviewJsonLd, hasOwnText, serializeJsonLd } from "@/lib/structured-data";
import { VERDICT_META } from "@/lib/verdict";

export const dynamic = "force-dynamic";

function description(a: { summaryEn: string; summaryId: string; explanation: string }): string {
  const text = (a.summaryEn || a.summaryId || a.explanation).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

/** Minutes to read the stored text at about 200 words a minute; computed here so the hero can show it without client code. */
function readingMinutes(a: { narration: string; explanation: string; source: string; reference: string; summaryEn: string; summaryId: string }): number {
  const words = [a.summaryEn || a.summaryId, a.narration, a.explanation, a.source, a.reference].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  const title = `${VERDICT_META[article.verdict].labelEn}: ${article.title}`;
  const summary = description(article);
  const linkOnly = !article.explanation && !article.narration;
  return {
    title: article.title,
    description: summary || `${VERDICT_META[article.verdict].labelEn} — fact-check archived from ${article.sourceSite || "the original source"}.`,
    alternates: { canonical: `/blog/${article.slug}` },
    // A link-only entry has no text of its own; the original fact-check is the page to index.
    ...(linkOnly ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description: summary,
      type: "article",
      url: `/blog/${article.slug}`,
    },
    // The preview image comes from ./opengraph-image.tsx.
    twitter: { card: "summary_large_image", title, description: summary },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const related = await findSimilarArticles(`${article.title}\n${article.narration.slice(0, 400)}`, 4, article.slug);
  return (
    <>
      {/* Structured data for search engines; link-only entries are not indexed, so they carry none. */}
      {hasOwnText(article) && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(claimReviewJsonLd(article)) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(article)) }} />
        </>
      )}
      <ArticleLayout article={article} related={related} readingMinutes={readingMinutes(article)} />
    </>
  );
}
