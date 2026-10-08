import Link from "next/link";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { popularArticles, type PopularResult } from "@/lib/stats";
import { formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";
import { Section } from "@/components/ui/Section";
import { getSiteT } from "@/lib/site-lang-server";

/**
 * The fact-checks people opened most in the last 30 days, from the research
 * log's visits. While the log is too thin to say, it shows the newest entries
 * and says "Latest" instead. Server component; the numbers are cached for ten
 * minutes in src/lib/stats.ts.
 */
export async function PopularPosts({ compact = false }: { compact?: boolean }) {
  const { t, lang } = await getSiteT();
  let result: PopularResult;
  try {
    result = await popularArticles(30, 5);
  } catch {
    return null;
  }
  const { items, popular, days } = result;
  if (items.length === 0) return null;
  const eyebrow = popular ? t("Popular this month") : t("Latest");

  if (compact) {
    return (
      <nav aria-label={eyebrow} className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="eyebrow shrink-0 pr-1">{eyebrow}</span>
        {items.map((a) => (
          <Link key={a.slug} href={`/blog/${a.slug}`} title={a.title} className="neu-btn flex max-w-[18rem] shrink-0 items-center gap-2 px-3.5 py-1.5 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: VERDICT_META[a.verdict].color }} aria-hidden />
            <span className="truncate">{a.title}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <Section>
      <div className="neu p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">{popular ? t("What people are reading.") : t("Fresh from the archive.")}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {popular ? t("The fact-checks opened most often in the last {days} days.", { days }) : t("The newest fact-checks with their full text. Most-read entries take this spot once enough people have visited.")}
            </p>
          </div>
          <Link href="/stats" className="text-sm text-ink-muted transition-colors hover:text-ink">
            {t("All the numbers →")}
          </Link>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((a, i) => (
            <li key={a.slug}>
              <Link href={`/blog/${a.slug}`} className="neu-inset group flex h-full flex-col gap-3 rounded-xl p-4 transition-colors hover:border-ink hover:bg-surface-raised">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <VerdictBadge verdict={a.verdict} />
                </div>
                <h3 className="line-clamp-3 font-display text-sm font-bold leading-snug text-ink transition-colors group-hover:text-brand">{a.title}</h3>
                <p className="mt-auto truncate text-xs text-ink-faint">
                  {[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date, "short", lang), popular && a.visits > 0 && (a.visits === 1 ? t("1 visit") : t("{n} visits", { n: a.visits }))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
