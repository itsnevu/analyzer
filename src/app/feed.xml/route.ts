import { listArticles } from "@/lib/articles";
import { buildRss } from "@/lib/rss";
import { SITE_URL } from "@/lib/site";
import { sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RSS 2.0 feed of the 50 newest published fact-checks that have text of their own. */
export async function GET() {
  const { items } = await listArticles({ withText: true, pageSize: 50 });
  const xml = buildRss(
    {
      title: "Hoax Detection & Analyzer — Fact-checks",
      link: `${SITE_URL}/blog`,
      description: "The latest Indonesian and English fact-checks in the Hoax Detection & Analyzer archive.",
      self: `${SITE_URL}/feed.xml`,
      language: "id",
    },
    items.map((a) => {
      const publisher = a.sourceSite ? sourceName(a.sourceSite) : "";
      return {
        title: a.title,
        link: `${SITE_URL}/blog/${a.slug}`,
        description: publisher ? `${a.summary} (Fact-check by ${publisher}.)` : a.summary,
        category: VERDICT_META[a.verdict].labelEn,
        date: a.date,
        sourceName: publisher || undefined,
        sourceUrl: a.sourceSite ? `https://${a.sourceSite}/` : undefined,
      };
    }),
  );
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
