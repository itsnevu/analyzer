import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getArticleStats, getArticleYears, getSourceCounts } from "@/lib/articles";
import { getDatasetOverview } from "@/lib/legacy-panel";
import { CLASS_META, DATASET_CLASSES } from "@/lib/dataset-classes";
import { DICT } from "@/lib/dictionary";
import { formatCount, sourceName } from "@/lib/sources";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About the Research",
  description: "How Hoax Detection & Analyzer works, what its archive and training data contain, and where its limits are.",
};

const APPROACHES = [
  { title: DICT["about.a1.title"], body: DICT["about.a1.body"] },
  { title: DICT["about.a2.title"], body: DICT["about.a2.body"] },
  { title: DICT["about.a3.title"], body: DICT["about.a3.body"] },
];

const LIMITS = [
  "It reads text. A screenshot is turned into text on your device first, so blurry or stylized images can be misread; check the text before analyzing.",
  "It compares your text with fact-checks published up to 2022. A brand-new claim may not be in the archive yet.",
  "A verdict is a prediction, not proof, and cannot serve as legal evidence. Always read the fact-check it points to.",
  "Several source sites have closed or moved since their articles were collected. Their links open the Internet Archive's copy instead.",
  "Indonesian and English are supported. Other languages are not analyzed reliably.",
];

function datasetOverview() {
  try {
    return getDatasetOverview();
  } catch {
    return null; // the dashboard tables are only there after `npm run import:panel`
  }
}

export default async function AboutPage() {
  const [stats, sources, years] = await Promise.all([getArticleStats(), getSourceCounts(), getArticleYears()]);
  const dataset = datasetOverview();
  const span = years.length ? `${years[years.length - 1]}–${years[0]}` : "";
  const verdicts = [
    { label: "Hoax", value: stats.hoax, color: "var(--hoax)" },
    { label: "Misleading", value: stats.misleading, color: "var(--warn)" },
    { label: "Credible", value: stats.valid, color: "var(--valid)" },
  ];

  return (
    <>
      <PageHeader eyebrowKey="about.eyebrow" titleKey="about.title.a" highlightKey="about.title.b" introKey="about.intro" image="/pages/about.jpg?v=2" />
      <section className="container-page pb-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {APPROACHES.map((a) => (
              <div key={a.title} className="neu p-6">
                <h2 className="font-display font-bold">{a.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{a.body}</p>
              </div>
            ))}
          </div>

          {/* The archive */}
          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">The archive</div>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {formatCount(stats.total)} fact-checks{span && `, ${span}`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Collected from {stats.sources} fact-checking sources: {formatCount(stats.indonesian)} in Indonesian and {formatCount(stats.english)} in English.
              Every entry keeps its verdict and a link to the original article.
            </p>

            <div className="mt-6 flex h-3 overflow-hidden rounded-full" role="img" aria-label={verdicts.map((v) => `${v.label} ${v.value}`).join(", ")}>
              {verdicts.map((v) => (
                <span key={v.label} style={{ width: `${(100 * v.value) / Math.max(stats.total, 1)}%`, background: v.color }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
              {verdicts.map((v) => (
                <li key={v.label} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                  {v.label} <span className="tabular-nums text-ink">{formatCount(v.value)}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 text-sm font-semibold">Sources</h3>
            <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {sources.map((s) => (
                <li key={s.site} className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2">
                  <Link href={`/blog?source=${encodeURIComponent(s.site)}`} className="text-ink hover:text-brand-to">
                    {sourceName(s.site)}
                  </Link>
                  <span className="tabular-nums text-ink-faint">{formatCount(s.count)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The training data */}
          {dataset && dataset.labeled > 0 && (
            <div className="neu p-6 sm:p-8">
              <div className="eyebrow">Training data</div>
              <h2 className="mt-3 font-display text-2xl font-bold">{formatCount(dataset.labeled)} labeled examples</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                The original detector learned from pages collected by its crawler, each labeled with the class the fact-checkers gave it.
                {dataset.unlabeled > 0 && ` Another ${formatCount(dataset.unlabeled)} collected pages were never labeled.`}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DATASET_CLASSES.map((c) => (
                  <div key={c} className="neu-inset rounded-xl p-4">
                    <div className="text-xl font-semibold tabular-nums">{formatCount(dataset.byClass[c])}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: CLASS_META[c].color }} />
                      {CLASS_META[c].label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How a check works today */}
          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">How a check works</div>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              <li><span className="font-semibold text-ink">1. Your text</span>: pasted, read from a link on the server, or read from a screenshot on your device.</li>
              <li><span className="font-semibold text-ink">2. The archive</span>: the rare words in your text are matched against every fact-check, so a claim that was debunked before is found even when it is worded differently.</li>
              <li><span className="font-semibold text-ink">3. The verdict</span>: comes from the trained detection model when it is connected. Until then, the closest matching fact-check decides, and a simple keyword check covers texts with no match; the result says which one answered.</li>
            </ol>
          </div>

          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">Limits</div>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-muted">
              {LIMITS.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-ink-faint">•</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>

          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">{DICT["about.research.eyebrow"]}</div>
            <h2 className="mt-3 font-display text-2xl font-bold">{DICT["about.research.title"]}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{DICT["about.research.body"]}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/detector" className="btn-primary px-6 py-3 text-sm">
                {DICT["about.tryDetector"]}
              </Link>
              <a href="https://rag-fusion.streamlit.app/" target="_blank" rel="noopener noreferrer" className="neu-btn px-6 py-3 text-sm font-medium">
                RAG Fusion (Streamlit) ↗
              </a>
            </div>
          </div>

          <div className="neu-inset flex flex-col items-start justify-between gap-3 p-6 text-sm sm:flex-row sm:items-center">
            <span className="text-ink-muted">{DICT["about.contactLine"]}</span>
            <a href="mailto:syyhoaxanalyzer@gmail.com" className="font-medium text-brand-to hover:underline">
              syyhoaxanalyzer@gmail.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
