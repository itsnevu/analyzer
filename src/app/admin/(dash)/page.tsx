import Link from "next/link";
import { getArticleStats } from "@/lib/articles";
import { getReportCounts } from "@/lib/reports";
import { sourceName } from "@/lib/sources";
import { CLASS_META, DATASET_CLASSES } from "@/lib/dataset-classes";
import { getDatasetByYear, getDatasetOverview, getDatasetSources } from "@/lib/legacy-panel";
import { getRepeatedSearches, getSearchOverview, getSearchesByMonth } from "@/lib/searches";
import { modelStatus } from "@/lib/baseline";
import { countOpenAttention } from "@/lib/attention";
import { countStopwords, listSkipDomains } from "@/lib/settings";
import { adminLocale, formatAdminDateTime, formatAdminMonth, formatAdminNumber, tk, type AdminLang, type AdminT } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { ClassCards } from "@/components/admin/charts/ClassCards";
import { MonthlyColumns } from "@/components/admin/charts/MonthlyColumns";
import { SourceBars } from "@/components/admin/charts/SourceBars";
import { StackedColumns } from "@/components/admin/charts/StackedColumns";
import { StatTile } from "@/components/admin/AdminPage";
import { AdminIcon } from "@/components/admin/AdminIcons";
import type { AdminIconName } from "@/components/admin/admin-nav";
import { DashboardWeek, ENGINE_LABEL, WeekDetails, loadWeek } from "@/components/admin/DashboardWeek";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const LANG_NAME: Record<string, string> = { id: tk("Indonesian"), en: tk("English"), ms: tk("Malay") };
const LABEL_NAME: Record<string, string> = { EDUKASI: tk("Education"), KLARIFIKASI: tk("Clarification"), UNKNOWN: tk("Unknown") };
const TOP_SOURCES = 10;

const QUICK_ACTIONS: { href: string; label: string; hint: string; icon: AdminIconName; primary?: boolean }[] = [
  { href: "/admin/detect", label: tk("Check a text"), hint: tk("See if a message is a hoax"), icon: "flask", primary: true },
  { href: "/admin/articles/new", label: tk("Write an article"), hint: tk("Add a new fact-check"), icon: "file" },
  { href: "/admin/reports", label: tk("Read reports"), hint: tk("Hoax reports and messages from visitors"), icon: "inbox" },
];

interface Todo {
  key: string;
  text: string;
  action: string;
  href: string;
  tone: "warn" | "hoax";
}

/** "Thursday, 9 October 2026" / "Kamis, 9 Oktober 2026", in Jakarta time; read outside render. */
function todayLabel(lang: AdminLang): string {
  return new Date().toLocaleDateString(adminLocale(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

/** The open "needs attention" claims; a count that fails leaves the item out instead of the page. */
function safeAttention(): number | null {
  try {
    return countOpenAttention(30);
  } catch (err) {
    console.error("[admin] attention count failed:", err);
    return null;
  }
}

/** Section inside "More numbers". */
function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {note && <p className="mt-0.5 max-w-3xl text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`neu-inset min-w-0 p-4 ${className}`}>
      <h4 className="font-semibold">{title}</h4>
      {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-hairline pb-1.5 last:border-b-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

export default async function AdminDashboard() {
  await requireAdmin();
  const { t, lang } = await getAdminT();
  const n = (v: number) => formatAdminNumber(v, lang);

  const [stats, reports] = await Promise.all([getArticleStats(), getReportCounts()]);
  const attention = safeAttention();
  const model = modelStatus();
  const week = loadWeek();
  const openReports = reports.byStatus.new + reports.byStatus["in-progress"];

  // Only what really needs a hand, in plain sentences.
  const todos: Todo[] = [];
  if (stats.hidden > 0) {
    todos.push({ key: "review", text: t("Hidden articles waiting for your verdict: {n}", { n: stats.hidden }), action: t("Review now"), href: "/admin/review", tone: "warn" });
  }
  if (reports.unread > 0) {
    todos.push({ key: "reports", text: t("New messages and reports you have not read yet: {n}", { n: reports.unread }), action: t("Read them"), href: "/admin/reports", tone: "hoax" });
  } else if (openReports > 0) {
    todos.push({ key: "reports", text: t("Messages and reports that are not finished yet: {n}", { n: openReports }), action: t("Open reports"), href: "/admin/reports", tone: "warn" });
  }
  if (attention) {
    todos.push({ key: "attention", text: t("Claims visitors checked that we have no article for yet: {n}", { n: attention }), action: t("Take a look"), href: "/admin/attention", tone: "warn" });
  }
  if (model.engine === "heuristic") {
    todos.push({ key: "model", text: t("The detector only uses a simple keyword check, because no trained model is available."), action: t("Open the model page"), href: "/admin/model", tone: "warn" });
  }

  const allClear = todos.length === 0;
  const status = allClear
    ? t("All caught up. Nothing needs your attention right now.")
    : todos.length === 1
      ? t("One thing needs your attention.")
      : t("{n} things need your attention.", { n: todos.length });

  return (
    <div className="space-y-4">
      {/* Status line */}
      <header className={`neu flex items-center gap-4 border-l-4 p-4 sm:px-5 ${allClear ? "border-l-verdict-valid" : "border-l-verdict-warn"}`}>
        <span
          aria-hidden
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl font-bold ${allClear ? "bg-verdict-valid/15 text-verdict-valid" : "bg-verdict-warn/15 text-verdict-warn"}`}
        >
          {allClear ? "✓" : "!"}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">{todayLabel(lang)}</p>
          <h1 className="font-display text-xl font-bold leading-snug sm:text-2xl">{status}</h1>
        </div>
      </header>

      {/* The four numbers that matter */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          size="lg"
          label={t("Fact-checks on the website")}
          value={n(stats.total)}
          note={t("Published, visible to everyone")}
          href="/admin/articles?visibility=public"
          tone="brand"
        />
        <StatTile
          size="lg"
          label={t("Waiting for your review")}
          value={n(stats.hidden)}
          note={t("Hidden until you give a verdict")}
          href="/admin/review"
          tone={stats.hidden ? "warn" : "valid"}
        />
        <StatTile
          size="lg"
          label={t("New messages & reports")}
          value={n(reports.unread)}
          note={reports.total ? t("Not read yet, out of {total} received", { total: reports.total }) : t("Nothing received yet")}
          href="/admin/reports"
          tone={reports.unread ? "hoax" : "valid"}
        />
        <StatTile size="lg" label={t("Checks by visitors")} value={n(week.checks)} note={t("In the last 7 days")} href="/admin/searches" tone="brand" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* To do */}
        <section className="neu p-4 sm:p-5 lg:col-span-2" aria-labelledby="todo-title">
          <h2 id="todo-title" className="font-display text-xl font-bold">
            {t("To do")}
          </h2>
          {allClear ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-verdict-valid/10 px-4 py-3">
              <span aria-hidden className="text-2xl text-verdict-valid">
                ✓
              </span>
              <div>
                <p className="text-[15px] font-semibold">{t("All caught up")}</p>
                <p className="text-sm text-ink-muted">{t("Nothing is waiting for you. New tasks will show up here.")}</p>
              </div>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-hairline">
              {todos.map((item) => (
                <li key={item.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <span className="flex min-w-0 flex-1 items-start gap-3 text-[15px] leading-snug">
                    <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "hoax" ? "bg-verdict-hoax" : "bg-verdict-warn"}`} />
                    {item.text}
                  </span>
                  <Link href={item.href} className="btn-primary inline-flex min-h-[40px] shrink-0 items-center justify-center self-start px-5 py-2 text-sm sm:self-auto">
                    {item.action} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick actions */}
        <section className="neu p-4 sm:p-5" aria-labelledby="quick-title">
          <h2 id="quick-title" className="font-display text-xl font-bold">
            {t("Quick actions")}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl px-4 py-2.5 transition-colors ${
                    a.primary ? "bg-ink text-surface-raised hover:opacity-90" : "border border-hairline text-ink hover:border-ink hover:bg-surface-sunken"
                  }`}
                >
                  <AdminIcon name={a.icon} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[15px] font-semibold">{t(a.label)}</span>
                    <span className={`block text-[13px] ${a.primary ? "text-surface-raised/75" : "text-ink-muted"}`}>{t(a.hint)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <DashboardWeek data={week} lang={lang} />

      <details className="neu group overflow-hidden p-0">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-sunken sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold">{t("More numbers")}</span>
            <span className="block text-sm text-ink-muted">{t("Details for the curious: articles by verdict, the detector, searches and the old dataset.")}</span>
          </span>
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline text-ink-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="space-y-6 border-t border-hairline px-4 py-5 sm:px-5">
          <MoreNumbers t={t} lang={lang} stats={stats} model={model} week={week} attention={attention} />
        </div>
      </details>
    </div>
  );
}

/** Everything technical, in one collapsed section; loaded with the page as before. */
function MoreNumbers({
  t,
  lang,
  stats,
  model,
  week,
  attention,
}: {
  t: AdminT;
  lang: AdminLang;
  stats: Awaited<ReturnType<typeof getArticleStats>>;
  model: ReturnType<typeof modelStatus>;
  week: ReturnType<typeof loadWeek>;
  attention: number | null;
}) {
  const n = (v: number) => formatAdminNumber(v, lang);
  const stopwords = countStopwords();
  const skipped = listSkipDomains();
  const dataset = getDatasetOverview();
  const years = getDatasetByYear();
  const sources = getDatasetSources();
  const search = getSearchOverview();
  const months = getSearchesByMonth();
  const repeated = getRepeatedSearches(5);

  const hasDataset = dataset.labeled + dataset.unlabeled > 0;
  const otherLabeled = dataset.other.reduce((s, o) => s + o.count, 0);

  const named = sources.map((s) => ({ name: sourceName(s.site), lang: s.lang, labeled: s.labeled, unlabeled: s.unlabeled }));
  const rest = named.slice(TOP_SOURCES);
  const sourceRows = rest.length
    ? [
        ...named.slice(0, TOP_SOURCES),
        {
          name: t("{n} other sites", { n: rest.length }),
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
  const decimals = (v: number) => v.toLocaleString(adminLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Block title={t("Published articles")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label={t("Hoax")} value={n(stats.hoax)} href="/admin/articles?visibility=public&verdict=hoax" tone="hoax" />
          <StatTile label={t("Misleading")} value={n(stats.misleading)} href="/admin/articles?visibility=public&verdict=misleading" tone="warn" />
          <StatTile label={t("Credible")} value={n(stats.valid)} href="/admin/articles?visibility=public&verdict=valid" tone="valid" />
          <StatTile label={t("Publishers")} value={n(stats.sources)} href="/admin/sources" />
          <StatTile label={t("In Indonesian")} value={n(stats.indonesian)} />
          <StatTile label={t("In English")} value={n(stats.english)} />
        </div>
      </Block>

      <Block title={t("The detector")} note={t("Which engine answers visitors' checks right now.")}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={t(ENGINE_LABEL[model.engine])} subtitle={model.engine === "heuristic" ? t("Demo mode: the answers are only a rough guess.") : undefined}>
            <dl className="space-y-1.5 text-sm">
              <Row label={t("External AI model (optional)")}>{model.external.configured ? model.external.host : t("not set up")}</Row>
              <Row label={t("Trained model")}>
                {model.baseline
                  ? t("{accuracy}% correct, F1 score {f1}", { accuracy: Math.round(model.baseline.accuracy * 100), f1: decimals(model.baseline.macroF1) })
                  : t("not trained yet")}
              </Row>
              {model.baseline && (
                <Row label={t("Last trained")}>
                  {t("{date}, on {n} fact-checks", { date: formatAdminDateTime(model.baseline.trainedAt, lang), n: model.baseline.docs })}
                </Row>
              )}
            </dl>
            <Link href="/admin/model" className="mt-3 inline-flex min-h-[40px] items-center text-sm font-medium text-brand hover:underline">
              {t("Model details, test and retrain →")}
            </Link>
          </Card>
          <Card title={t("Settings")}>
            <p className="text-sm text-ink-muted">
              {t("{id} Indonesian, {en} English and {ms} Malay stopwords, and {domains} skipped websites.", {
                id: stopwords.id,
                en: stopwords.en,
                ms: stopwords.ms,
                domains: skipped.length,
              })}
            </p>
            <Link href="/admin/settings" className="mt-3 inline-flex min-h-[40px] items-center text-sm font-medium text-brand hover:underline">
              {t("Open settings →")}
            </Link>
          </Card>
        </div>
      </Block>

      <Block title={t("Visitor checks in detail")}>
        <WeekDetails data={week} lang={lang} open={attention} />
      </Block>

      <Block title={t("Searches, all time")} note={t("Texts and links people checked with the detector. The old panel logged them from April 2019; IP addresses were not copied.")}>
        {search.total > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <Card
              title={t("Searches per month")}
              subtitle={
                search.first && search.last
                  ? t("{from} to {to}", { from: formatAdminMonth(search.first.slice(0, 7), lang), to: formatAdminMonth(search.last.slice(0, 7), lang) })
                  : undefined
              }
              className="lg:col-span-2"
            >
              <MonthlyColumns points={months} />
            </Card>

            <Card title={t("All time")}>
              <div className="text-4xl font-semibold tracking-tight">{n(search.total)}</div>
              <div className="mt-1 text-sm text-ink-muted">{t("searches")}</div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label={t("Different texts")}>{n(search.distinct)}</Row>
                <Row label={t("Pasted links")}>{`${n(search.links)} (${Math.round((search.links / search.total) * 100)}%)`}</Row>
                <Row label={t("Made on this site")}>{n(search.fromSite)}</Row>
              </dl>
              {repeated.length > 0 && (
                <>
                  <h5 className="mt-4 text-sm font-semibold text-ink-muted">{t("Checked most often")}</h5>
                  <ol className="mt-1.5 space-y-1.5 text-sm">
                    {repeated.map((r) => (
                      <li key={r.query} className="flex items-baseline gap-2">
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-faint">{n(r.count)}×</span>
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
          <p className="text-sm text-ink-muted">{t("No searches logged yet.")}</p>
        )}
      </Block>

      <Block
        title={t("The old detector's training data")}
        note={t("Copied from the old detector panel (/adminpanel/). Each row is a page the old crawler collected; the label is what the old detector learned from.")}
      >
        {hasDataset ? (
          <>
            <ClassCards byClass={dataset.byClass} labeled={dataset.labeled} lang={lang} />

            <Card
              title={t("Labeled rows by year published")}
              subtitle={
                otherLabeled
                  ? t("{n} labeled rows; the {m} rows with other labels are not in this chart", { n: dataset.labeled, m: otherLabeled })
                  : t("{n} labeled rows", { n: dataset.labeled })
              }
            >
              <StackedColumns
                labels={years.map((y) => y.year)}
                series={DATASET_CLASSES.map((key) => ({ key, color: CLASS_META[key].color, label: t(CLASS_META[key].label) }))}
                values={years.map((y) => ({ ...y.byClass }))}
                unit={t("rows")}
              />
            </Card>

            <div className="grid gap-3 lg:grid-cols-5">
              <Card title={t("Rows per source website")} subtitle={t("Labeled, then unlabeled")} className="lg:col-span-3">
                <SourceBars rows={sourceRows} lang={lang} />
              </Card>

              <Card title={t("Data notes")} className="lg:col-span-2">
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="text-ink-muted">{t("Never labeled")}</dt>
                    <dd className="mt-0.5">
                      <span className="text-2xl font-semibold">{n(dataset.unlabeled)}</span>
                      <span className="text-ink-faint"> {t("rows")}</span>
                    </dd>
                    {mostUnlabeled.length > 0 && (
                      <dd className="mt-1 text-xs text-ink-faint">
                        {t("Mostly {list}", { list: mostUnlabeled.map((s) => `${s.name} (${n(s.unlabeled)})`).join(", ") })}
                      </dd>
                    )}
                  </div>
                  {dataset.other.length > 0 && (
                    <div>
                      <dt className="text-ink-muted">{t("Other labels")}</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {dataset.other.map((o) => (
                          <span key={o.label} className="rounded-full border border-hairline px-2.5 py-0.5 text-xs">
                            {LABEL_NAME[o.label] ? t(LABEL_NAME[o.label]) : o.label} <span className="tabular-nums text-ink-faint">{n(o.count)}</span>
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-ink-muted">{t("Language of the source website")}</dt>
                    <dd className="mt-1 space-y-0.5 text-xs">
                      {byLang.map(([code, count]) => (
                        <div key={code} className="flex justify-between gap-3">
                          <span>{t(LANG_NAME[code] ?? "Unknown")}</span>
                          <span className="tabular-nums text-ink-muted">{n(count)}</span>
                        </div>
                      ))}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            {t("The old panel's data is not in the database yet. Run this command:")} <code className="font-mono">npm run import:panel</code>
          </p>
        )}
      </Block>
    </>
  );
}
