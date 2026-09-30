import { Hero } from "@/components/home/Hero";
import { SourcesMarquee } from "@/components/home/SourcesMarquee";
import { Stats } from "@/components/home/Stats";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FeatureComparison } from "@/components/home/FeatureComparison";
import { Tips } from "@/components/home/Tips";
import { RecentPosts } from "@/components/home/RecentPosts";
import { Faq } from "@/components/home/Faq";
import { CtaBand } from "@/components/home/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { getArticleStats, getSourceCounts, listArticles } from "@/lib/articles";

// The numbers and the latest entries come straight from the database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, sources, recent] = await Promise.all([getArticleStats(), getSourceCounts(), listArticles({ pageSize: 3, withText: true })]);
  const items = [
    { value: stats.total, suffix: "", label: "Fact-check articles", sub: "In the searchable archive" },
    { value: stats.indonesian, suffix: "", label: "Indonesian entries", sub: "Local fact-checkers" },
    { value: stats.english, suffix: "", label: "English entries", sub: "International sources" },
    { value: stats.sources, suffix: "", label: "Fact-checking sources", sub: "Every entry links to its original" },
  ];

  return (
    <>
      <Hero />
      <SourcesMarquee sources={sources} />
      <Reveal><Stats items={items} /></Reveal>
      <Reveal><RecentPosts articles={recent.items} total={stats.total} /></Reveal>
      <Reveal><HowItWorks /></Reveal>
      <Reveal><FeatureComparison /></Reveal>
      <Reveal><Tips /></Reveal>
      <Reveal><Faq /></Reveal>
      <Reveal><CtaBand /></Reveal>
    </>
  );
}
