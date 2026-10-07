import type { Article } from "./data";
import type { Verdict } from "./detect";
import { SITE_URL } from "./site";
import { sourceName } from "./sources";
import { VERDICT_META } from "./verdict";

/**
 * JSON-LD for an article page: a schema.org ClaimReview (what search engines
 * read fact-checks from) and the breadcrumb trail. Pure functions, no I/O.
 */

export const SITE_NAME = "Hoax Detection & Analyzer";

/** schema.org Rating for each verdict: 1 is the worst (hoax), 5 the best (credible). */
export const RATING_VALUE: Record<Verdict, number> = { hoax: 1, misleading: 3, valid: 5 };

/** "[SALAH] Vaksin membuat tubuh magnetis" → "Vaksin membuat tubuh magnetis". */
export function stripLeadingTag(title: string): string {
  return title.replace(/^\s*[[(][^\])]{2,40}[\])]\s*:?\s*/, "").trim() || title.trim();
}

/** Whether an article has text of its own; link-only entries are not indexed, so they get no ClaimReview. */
export function hasOwnText(a: Pick<Article, "explanation" | "narration">): boolean {
  return Boolean(a.explanation || a.narration);
}

export function articleUrl(slug: string): string {
  return `${SITE_URL}/blog/${slug}`;
}

export function claimReviewJsonLd(a: Article): Record<string, unknown> {
  const publisher = a.sourceSite ? sourceName(a.sourceSite) : SITE_NAME;
  const claim = a.narration.replace(/\s+/g, " ").trim() || stripLeadingTag(a.title);
  const datePublished = /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    url: articleUrl(a.slug),
    claimReviewed: claim,
    ...(datePublished ? { datePublished } : {}),
    inLanguage: a.lang,
    author: {
      "@type": "Organization",
      name: publisher,
      ...(a.originalUrl ? { url: a.originalUrl } : a.sourceSite ? {} : { url: SITE_URL }),
    },
    itemReviewed: {
      "@type": "Claim",
      ...(a.originalUrl ? { appearance: { "@type": "CreativeWork", url: a.originalUrl } } : {}),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: RATING_VALUE[a.verdict],
      bestRating: 5,
      worstRating: 1,
      alternateName: VERDICT_META[a.verdict].labelEn,
    },
  };
}

export function breadcrumbJsonLd(a: Pick<Article, "slug" | "title">): Record<string, unknown> {
  const crumbs = [
    { name: "Home", item: `${SITE_URL}/` },
    { name: "Archive", item: `${SITE_URL}/blog` },
    { name: a.title, item: articleUrl(a.slug) },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };
}

/**
 * JSON for an inline <script type="application/ld+json">. Every "<" becomes
 * <, so a title containing "</script>" cannot end the tag early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
