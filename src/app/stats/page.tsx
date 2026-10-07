import type { Metadata } from "next";
import Link from "next/link";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { CHART } from "@/components/admin/charts/chart-kit";
import { MonthlyColumns } from "@/components/admin/charts/MonthlyColumns";
import { SourceBars } from "@/components/admin/charts/SourceBars";
import { StackedColumns } from "@/components/admin/charts/StackedColumns";
import { PageHeader } from "@/components/ui/PageHeader";
import { LANGUAGE_NAME, formatCount, formatDate, sourceName } from "@/lib/sources";
import { VERDICTS, archiveByPublisher, archiveByYear, archiveOverview, detectorUsage, newestEntries } from "@/lib/stats";
import { VERDICT_META } from "@/lib/verdict";

// Live numbers from the database (cached for ten minutes in src/lib/stats.ts).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Statistics",
  description: "The fact-check archive in numbers: entries per year, verdict, publisher and language, and how often the hoax detector is used.",
  alternates: { canonical: "/stats" },
};

const TOP_PUBLISHERS = 10;

const share = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(n / total < 0.1 ? 1 : 0)}%` : "0%");
const monthYear = (ym: string) => (ym ? new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "");
const year = (date: string) => date.slice(0, 4);

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`neu min-w-0 p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** One horizontal bar split into coloured segments, with a legend that carries the counts. */
function ShareBar({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const drawn = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={segments.map((s) => `${s.label}: ${formatCount(s.value)}`).join(", ")}>
        {drawn.map((s) => (
          <span key={s.label} className="h-full" style={{ width: `${(s.value / Math.max(total, 1)) * 100}%`, background: s.color, minWidth: 2 }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="flex-1 text-ink-muted">{s.label}</span>
            <span className="tabular-nums font-semibold text-ink">{formatCount(s.value)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-ink-faint">{share(s.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function StatsPage() {
  // First, so an empty database is seeded with the examples before the counts are cached.
  const newest = await newestEntries(5);
  const overview = archiveOverview();
  const years = archiveByYear();
  const publishers = archiveByPublisher();
  const usage = detectorUsage();

  const tiles = [
    { value: formatCount(overview.total), label: "Fact-checks in the archive", sub: overview.first ? `Published ${year(overview.first)}–${year(overview.last)}` : "Published entries" },
    { value: share(overview.byVerdict.hoax, overview.total), label: "Found to be a hoax", sub: `${formatCount(overview.byVerdict.hoax)} entries` },
    { value: formatCount(overview.publishers), label: "Fact-checking publishers", sub: "Every entry links to its original" },
    { value: formatCount(usage.total), label: "Detector checks", sub: usage.first ? `Since ${monthYear(usage.first)}` : "Counted from the search log" },
  ];

  const named = publishers.map((p) => ({ name: sourceName(p.site), lang: "", labeled: p.withText, unlabeled: p.linkOnly }));
  const rest = named.slice(TOP_PUBLISHERS);
  const publisherRows = rest.length
    ? [
        ...named.slice(0, TOP_PUBLISHERS),
        { name: `${rest.length} other ${rest.length === 1 ? "site" : "sites"}`, lang: "", labeled: rest.reduce((s, r) => s + r.labeled, 0), unlabeled: rest.reduce((s, r) => s + r.unlabeled, 0) },
      ]
    : named;

  const verdictSeries = VERDICTS.map((v) => ({ key: v, label: VERDICT_META[v].labelEn, color: VERDICT_META[v].color }));

  return (
    <>
      <PageHeader eyebrowKey="stats.eyebrow" titleKey="stats.title" introKey="stats.intro" />

      <section className="container-page space-y-4 pb-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="neu p-5">
              <div className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="gradient-text">{t.value}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-ink">{t.label}</div>
              <div className="mt-1 text-xs text-ink-faint">{t.sub}</div>
            </div>
          ))}
        </div>

        {years.length > 0 && (
          <Card
            title="Fact-checks per year"
            subtitle={`By the year the fact-check was published, coloured by its verdict.${overview.undated ? ` ${formatCount(overview.undated)} ${overview.undated === 1 ? "entry has" : "entries have"} no date and ${overview.undated === 1 ? "is" : "are"} left out.` : ""}`}
          >
            <StackedColumns labels={years.map((y) => y.year)} series={verdictSeries} values={years.map((y) => ({ ...y.byVerdict }))} unit="fact-checks" />
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <Card title="Entries per publisher" subtitle="The fact-checking sites the archive was collected from. Some entries keep the full text; others only the verdict and a link." className="lg:col-span-3">
            <SourceBars rows={publisherRows} legend={{ labeled: "With full text", unlabeled: "Link only" }} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
            <Card title="Verdicts">
              <ShareBar segments={VERDICTS.map((v) => ({ label: VERDICT_META[v].labelEn, value: overview.byVerdict[v], color: VERDICT_META[v].color }))} total={overview.total} />
            </Card>
            <Card title="Languages">
              <ShareBar
                segments={[
                  { label: LANGUAGE_NAME.id, value: overview.byLang.id, color: CHART.brand },
                  { label: LANGUAGE_NAME.en, value: overview.byLang.en, color: CHART.neutral },
                ]}
                total={overview.total}
              />
            </Card>
            <Card title="Text kept" subtitle="Entries with the fact-check's own text can be searched and read here; link-only ones point to the original.">
              <ShareBar
                segments={[
                  { label: "Full text", value: overview.withText, color: CHART.brand },
                  { label: "Link only", value: overview.linkOnly, color: CHART.neutral },
                ]}
                total={overview.total}
              />
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card
            title="Detector checks per month"
            subtitle={usage.first ? `Texts and links submitted to the detector, ${monthYear(usage.first)} to ${monthYear(usage.last)}. Counts only; what people checked stays private.` : "Texts and links submitted to the detector. Counts only; what people checked stays private."}
            className="lg:col-span-3"
          >
            {usage.total > 0 ? <MonthlyColumns points={usage.months} /> : <p className="py-8 text-center text-sm text-ink-faint">No checks logged yet.</p>}
          </Card>

          <Card title="Newest entries" subtitle="The latest fact-checks with their full text." className="lg:col-span-2">
            <ul className="divide-y divide-hairline">
              {newest.map((a) => (
                <li key={a.slug}>
                  <Link href={`/blog/${a.slug}`} className="group flex items-start gap-3 py-3 transition-colors">
                    <VerdictBadge verdict={a.verdict} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug text-ink transition-colors group-hover:text-brand">{a.title}</span>
                      <span className="mt-1 block text-xs text-ink-faint">{[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {newest.length === 0 && <li className="py-6 text-center text-sm text-ink-faint">No entries yet.</li>}
            </ul>
            <Link href="/blog" className="neu-btn mt-3 inline-flex px-4 py-2 text-sm">
              Browse the archive →
            </Link>
          </Card>
        </div>

        <div className="neu-inset rounded-2xl p-5 text-sm leading-relaxed text-ink-muted sm:p-6">
          <h2 className="eyebrow">Where the numbers come from</h2>
          <p className="mt-3">
            The archive numbers count the published entries of the{" "}
            <Link href="/blog" className="font-medium text-ink hover:text-brand-to">
              fact-check archive
            </Link>
            , collected from public fact-checking sites such as TurnBackHoax (MAFINDO), Kominfo, CekFakta.com, Tempo and Hoax-Slayer; the year is the one the original fact-check was
            published. Detector checks are counted from the detector&apos;s search log, which the previous version of this site started in April 2019; only the number of checks is shown,
            never the texts. Everything on this page is read from the live database and refreshed every ten minutes. Read more{" "}
            <Link href="/about" className="font-medium text-ink hover:text-brand-to">
              about the research
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-ink hover:text-brand-to">
              what is recorded
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
