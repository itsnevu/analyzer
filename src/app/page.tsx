import { Hero } from "@/components/home/Hero";
import { SourcesMarquee } from "@/components/home/SourcesMarquee";
import { Stats } from "@/components/home/Stats";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ExampleResult } from "@/components/home/ExampleResult";
import { Tips } from "@/components/home/Tips";
import { RecentPosts } from "@/components/home/RecentPosts";
import { PopularPosts } from "@/components/home/PopularPosts";
import { Faq } from "@/components/home/Faq";
import { CtaBand } from "@/components/home/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { getArticleStats, getSourceCounts, listArticles } from "@/lib/articles";
import { getSiteT } from "@/lib/site-lang-server";

// The numbers and the latest entries come straight from the database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, sources, recent, { t }] = await Promise.all([getArticleStats(), getSourceCounts(), listArticles({ pageSize: 3, withText: true }), getSiteT()]);
  const items = [
    { value: stats.total, suffix: "", label: t("Fact-check articles"), sub: t("In the searchable archive") },
    { value: stats.indonesian, suffix: "", label: t("Indonesian entries"), sub: t("Local fact-checkers") },
    { value: stats.english, suffix: "", label: t("English entries"), sub: t("International sources") },
    { value: stats.sources, suffix: "", label: t("Fact-checking sources"), sub: t("Every entry links to its original") },
  ];

  return (
    <>
      <Hero counts={{ total: stats.total, sources: stats.sources }} />
      <SourcesMarquee sources={sources} />
      <Reveal><Stats items={items} /></Reveal>
      <Reveal><RecentPosts articles={recent.items} total={stats.total} /></Reveal>
      <Reveal><PopularPosts /></Reveal>
      <Reveal><HowItWorks /></Reveal>
      <Reveal><ExampleResult /></Reveal>
      <Reveal><Tips /></Reveal>
      <Reveal><Faq /></Reveal>
      <Reveal><CtaBand /></Reveal>
    </>
  );
}
