import Link from "next/link";
import { getArticleStats, listArticles } from "@/lib/articles";
import { getAllReports } from "@/lib/reports";
import { VERDICT_META } from "@/lib/verdict";
import { formatCount, formatDate, sourceName } from "@/lib/sources";
import { CLASS_META, DATASET_CLASSES } from "@/lib/dataset-classes";
import { getDatasetByYear, getDatasetOverview, getDatasetSources } from "@/lib/legacy-panel";
import { getRecentSearches, getRepeatedSearches, getSearchOverview, getSearchesByMonth } from "@/lib/searches";
import { modelStatus } from "@/lib/baseline";
import { countStopwords, listSkipDomains } from "@/lib/settings";
import { ClassCards } from "@/components/admin/charts/ClassCards";
import { MonthlyColumns } from "@/components/admin/charts/MonthlyColumns";
import { SourceBars } from "@/components/admin/charts/SourceBars";
import { StackedColumns } from "@/components/admin/charts/StackedColumns";
import { AdminPageHeader, StatTile } from "@/components/admin/AdminPage";
import { DashboardWeek } from "@/components/admin/DashboardWeek";

export const dynamic = "force-dynamic";

const LANG_NAME: Record<string, string> = { id: "Indonesian", en: "English", ms: "Malay" };
const LABEL_NAME: Record<string, string> = { EDUKASI: "Education", KLARIFIKASI: "Clarification", UNKNOWN: "Unknown" };
const TOP_SOURCES = 10;
const ENGINE_NAME = { external: "External model", baseline: "Trained classifier", heuristic: "Keyword heuristic (demo mode)" } as const;
const TOOLS = [
  { href: "/admin/detect", label: "Detection lab", note: "Score a text against the archive with BM25, Levenshtein, Damerau, Smith–Waterman, Jaccard or cosine." },
  { href: "/admin/extract", label: "Extract from a page", note: "Turn a fact-check page or a forwarded message into a draft article." },
  { href: "/admin/review", label: "Review queue", note: "Give the hidden entries a verdict, one at a time." },
  { href: "/admin/attention", label: "Needs attention", note: "Claims people checked that the archive could not answer yet." },
  { href: "/admin/dataset", label: "Dataset", note: "The old detector's 17k labeled and unlabeled rows; relabel or add to the archive." },
  { href: "/admin/sources", label: "Sources", note: "The 23 sites the old crawler collected from, with counts." },
  { href: "/admin/searches", label: "Searches", note: "Every text submitted to the detector, old panel included." },
  { href: "/admin/research", label: "Research log", note: "Visits and checks with network and device, for the paper." },
  { href: "/admin/settings", label: "Settings", note: "Stopwords per language, HTML entity replacements, skipped domains." },
];

const monthYear = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function Section({ eyebrow, title, note, children }: { eyebrow: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-1.5 font-display text-xl font-bold">{title}</h2>
        {note && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`neu min-w-0 p-5 ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default async function AdminDashboard() {
  const [stats, recent, reports] = await Promise.all([getArticleStats(), listArticles({ visibility: "all", pageSize: 6 }), getAllReports()]);
  const unread = reports.filter((r) => !r.readAt).length;
  const tiles: { label: string; value: number; href: string; tone?: "valid" | "warn" | "hoax" | "brand"; note?: string }[] = [
    { label: "Published articles", value: stats.total, href: "/admin/articles?visibility=public", tone: "brand", note: `${formatCount(stats.sources)} publishers` },
    { label: "Hoax", value: stats.hoax, href: "/admin/articles?visibility=public&verdict=hoax", tone: "hoax" },
    { label: "Misleading", value: stats.misleading, href: "/admin/articles?visibility=public&verdict=misleading", tone: "warn" },
    { label: "Credible", value: stats.valid, href: "/admin/articles?visibility=public&verdict=valid", tone: "valid" },
    { label: "Hidden, needs review", value: stats.hidden, href: "/admin/review", tone: stats.hidden ? "warn" : undefined },
    { label: "Reports received", value: reports.length, href: "/admin/reports", note: unread ? `${formatCount(unread)} unread` : undefined },
  ];

  const model = modelStatus();
  const stopwords = countStopwords();
  const skipped = listSkipDomains();
  const dataset = getDatasetOverview();
  const years = getDatasetByYear();
  const sources = getDatasetSources();
  const search = getSearchOverview();
  const months = getSearchesByMonth();
  const latestSearches = getRecentSearches(6);
  const repeated = getRepeatedSearches(5);

  const hasDataset = dataset.labeled + dataset.unlabeled > 0;
  const otherLabeled = dataset.other.reduce((s, o) => s + o.count, 0);

  const named = sources.map((s) => ({ name: sourceName(s.site), lang: s.lang, labeled: s.labeled, unlabeled: s.unlabeled }));
  const rest = named.slice(TOP_SOURCES);
  const sourceRows = rest.length
    ? [
        ...named.slice(0, TOP_SOURCES),
        {
          name: `${rest.length} other sites`,
          lang: "",
          labeled: rest.reduce((s, r) => s + r.labeled, 0),
          unlabeled: rest.reduce((s, r) => s + r.unlabeled, 0),
        },
      ]
    : named;
  const mostUnlabeled = [...named].sort((a, b) => b.unlabeled - a.unlabeled).filter((s) => s.unlabeled > 0).slice(0, 3);
  const byLang = Object.entries(
    sources.reduce<Record<string, number>>((acc, s) => {
      acc[s.lang] = (acc[s.lang] ?? 0) + s.labeled + s.unlabeled;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        className="mb-0"
        title="Dashboard"
        description="The archive, the detector and what visitors did with them, at a glance."
        actions={
          <>
            <Link href="/admin/detect" className="neu-btn px-4 py-2.5 text-sm">
              Detection lab
            </Link>
            <Link href="/admin/articles/new" className="btn-primary px-5 py-2.5 text-sm">
              + Add article
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((s) => (
          <StatTile key={s.label} label={s.label} value={formatCount(s.value)} href={s.href} tone={s.tone} note={s.note} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card title="Detector engine" subtitle="Which engine answers public checks right now" className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: model.engine === "heuristic" ? "var(--warn)" : "var(--valid)" }} aria-hidden />
            <span className="text-lg font-semibold">{ENGINE_NAME[model.engine]}</span>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3 border-b border-hairline pb-1.5">
              <dt className="text-ink-muted">External model (optional)</dt>
              <dd className="truncate">{model.external.configured ? model.external.host : "not configured"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-hairline pb-1.5">
              <dt className="text-ink-muted">Trained classifier</dt>
              <dd>{model.baseline ? `${Math.round(model.baseline.accuracy * 100)}% accuracy, F1 ${model.baseline.macroF1.toFixed(2)}` : "not trained"}</dd>
            </div>
            {model.baseline && (
              <div className="flex justify-between gap-3 border-b border-hairline pb-1.5">
                <dt className="text-ink-muted">Trained</dt>
                <dd>{formatDate(model.baseline.trainedAt.slice(0, 10)) || model.baseline.trainedAt} on {formatCount(model.baseline.docs)} fact-checks</dd>
              </div>
            )}
          </dl>
          <Link href="/admin/model" className="mt-4 inline-block text-sm text-brand hover:underline">
            Model details, ping and retrain →
          </Link>
        </Card>

        <Card title="Tools" subtitle="Rebuilt from the old panel's menus" className="lg:col-span-3">
          <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="font-medium hover:text-brand">
                  {t.label}
                </Link>
                <span className="block text-xs text-ink-faint">{t.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-faint">
            Settings hold {formatCount(stopwords.id)} Indonesian, {formatCount(stopwords.en)} English and {formatCount(stopwords.ms)} Malay stopwords and {skipped.length} skipped {skipped.length === 1 ? "domain" : "domains"}.
          </p>
        </Card>
      </div>

      <DashboardWeek />

      <Section
        eyebrow="Legacy detector"
        title="Training dataset"
        note="Copied from the old detector panel (/adminpanel/). Every row is a page the old crawler collected; the label is the class the old detector learned from."
      >
        {hasDataset ? (
          <>
            <ClassCards byClass={dataset.byClass} labeled={dataset.labeled} />

            <Card
              title="Labeled rows by publish year"
              subtitle={`${formatCount(dataset.labeled)} labeled rows${otherLabeled ? `; the ${formatCount(otherLabeled)} with smaller labels are left out of this chart` : ""}`}
            >
              <StackedColumns
                labels={years.map((y) => y.year)}
                series={DATASET_CLASSES.map((key) => ({ key, ...CLASS_META[key] }))}
                values={years.map((y) => ({ ...y.byClass }))}
                unit="rows"
              />
            </Card>

            <div className="grid gap-3 lg:grid-cols-5">
              <Card title="Rows per source site" subtitle="Labeled, then unlabeled" className="lg:col-span-3">
                <SourceBars rows={sourceRows} />
              </Card>

              <Card title="Data notes" className="lg:col-span-2">
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-ink-muted">Never labeled</dt>
                    <dd className="mt-0.5">
                      <span className="text-2xl font-semibold">{formatCount(dataset.unlabeled)}</span>
                      <span className="text-ink-faint"> rows</span>
                    </dd>
                    {mostUnlabeled.length > 0 && (
                      <dd className="mt-1 text-xs text-ink-faint">
                        Mostly {mostUnlabeled.map((s) => `${s.name} (${formatCount(s.unlabeled)})`).join(", ")}
                      </dd>
                    )}
                  </div>
                  {dataset.other.length > 0 && (
                    <div>
                      <dt className="text-ink-muted">Other labels</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {dataset.other.map((o) => (
                          <span key={o.label} className="rounded-full border border-hairline px-2.5 py-0.5 text-xs">
                            {LABEL_NAME[o.label] ?? o.label} <span className="tabular-nums text-ink-faint">{formatCount(o.count)}</span>
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-ink-muted">Language of the source site</dt>
                    <dd className="mt-1 space-y-0.5 text-xs">
                      {byLang.map(([lang, n]) => (
                        <div key={lang} className="flex justify-between gap-3">
                          <span>{LANG_NAME[lang] ?? "Unknown"}</span>
                          <span className="tabular-nums text-ink-muted">{formatCount(n)}</span>
                        </div>
                      ))}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          </>
        ) : (
          <div className="neu p-8 text-center text-sm text-ink-muted">
            The legacy panel data is not in the database yet. Run <code className="font-mono">npm run import:panel</code>.
          </div>
        )}
      </Section>

      <Section
        eyebrow="Detector"
        title="Searches"
        note="Text and links people submitted to the detector. The old panel logged them from April 2019; IP addresses were not copied."
      >
        {search.total > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <Card
              title="Searches per month"
              subtitle={search.first && search.last ? `${monthYear(search.first.slice(0, 7))} to ${monthYear(search.last.slice(0, 7))}` : undefined}
              className="lg:col-span-2"
            >
              <MonthlyColumns points={months} />
            </Card>

            <Card title="All time">
              <div className="text-5xl font-semibold tracking-tight">{formatCount(search.total)}</div>
              <div className="mt-1 text-sm text-ink-muted">searches</div>
              <dl className="mt-4 space-y-1.5 text-sm">
                {[
                  ["Distinct queries", formatCount(search.distinct)],
                  ["Pasted links", `${formatCount(search.links)} (${Math.round((search.links / search.total) * 100)}%)`],
                  ["Made on this site", formatCount(search.fromSite)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-hairline pb-1.5">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {repeated.length > 0 && (
                <>
                  <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Most repeated</h4>
                  <ol className="mt-2 space-y-1.5 text-sm">
                    {repeated.map((r) => (
                      <li key={r.query} className="flex items-baseline gap-2">
                        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-faint">{r.count}×</span>
                        <span className="truncate" title={r.query}>
                          {r.query}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Card>
          </div>
        ) : (
          <div className="neu p-8 text-center text-sm text-ink-muted">No searches logged yet.</div>
        )}
      </Section>

      <div className="grid gap-3 pt-4 lg:grid-cols-2">
        <div className="neu min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Latest articles</h2>
            <Link href="/admin/articles" className="text-sm text-ink-muted hover:text-ink">
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-hairline">
            {recent.items.map((a) => {
              const m = VERDICT_META[a.verdict];
              return (
                <li key={a.slug} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/articles/${a.slug}/edit`} className="block truncate text-sm font-medium hover:text-brand">
                      {a.title}
                    </Link>
                    <div className="truncate text-xs text-ink-faint">
                      {[a.category, a.sourceSite && sourceName(a.sourceSite), formatDate(a.date), !a.published && "hidden"].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
                    {m.labelEn}
                  </span>
                </li>
              );
            })}
            {recent.items.length === 0 && <li className="py-6 text-center text-sm text-ink-faint">No articles yet.</li>}
          </ul>
        </div>

        <div className="neu min-w-0 p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Latest searches</h2>
          <ul className="divide-y divide-hairline">
            {latestSearches.map((s) => {
              const isLink = /^https?:\/\//i.test(s.query);
              const verdict = s.verdict && s.verdict in VERDICT_META ? VERDICT_META[s.verdict as keyof typeof VERDICT_META] : null;
              return (
                <li key={s.id} className="py-2.5">
                  <div className="truncate text-sm" title={s.query}>
                    {s.query}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
                    <span>{formatDate(s.createdAt.slice(0, 10))}</span>
                    <span>· {isLink ? "link" : "text"}</span>
                    <span>· {s.origin === "legacy" ? "old panel" : "this site"}</span>
                    {verdict && (
                      <span className="flex items-center gap-1">
                        · <span className="h-2 w-2 rounded-full" style={{ background: verdict.color }} aria-hidden />
                        {verdict.labelEn}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {latestSearches.length === 0 && <li className="py-6 text-center text-sm text-ink-faint">No searches yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
