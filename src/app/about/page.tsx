import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { rich } from "@/components/ui/Rich";
import { getDatasetOverview } from "@/lib/legacy-panel";
import { CLASS_META, DATASET_CLASSES } from "@/lib/dataset-classes";
import { formatCount } from "@/lib/sources";
import { tk } from "@/lib/site-lang";
import { getSiteT } from "@/lib/site-lang-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return {
    title: t("About the Research"),
    description: t("How Hoax Detection & Analyzer works, what its archive and training data contain, and where its limits are."),
  };
}

const APPROACHES = [
  { title: "about.a1.title", body: "about.a1.body" },
  { title: "about.a2.title", body: "about.a2.body" },
  { title: "about.a3.title", body: "about.a3.body" },
];

const LIMITS = [
  tk("It reads text. A screenshot is turned into text on your device first, so blurry or stylized images can be misread; check the text before analyzing."),
  tk("It compares your text with fact-checks published up to 2022. A brand-new claim may not be in the archive yet."),
  tk("A verdict is a prediction, not proof, and cannot serve as legal evidence. Always read the fact-check it points to."),
  tk("Several source sites have closed or moved since their articles were collected. Their links open the Internet Archive's copy instead."),
  tk("Indonesian and English are supported. Other languages are not analyzed reliably."),
];

function datasetOverview() {
  try {
    return getDatasetOverview();
  } catch {
    return null; // the dashboard tables are only there after `npm run import:panel`
  }
}

export default async function AboutPage() {
  const { t, lang } = await getSiteT();
  const count = (n: number) => formatCount(n, lang);
  const dataset = datasetOverview();

  return (
    <>
      <PageHeader eyebrowKey="about.eyebrow" titleKey="about.title.a" highlightKey="about.title.b" introKey="about.intro" image="/pages/network-transparent.webp" imageTransparent />
      <section className="container-page pb-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {APPROACHES.map((a) => (
              <div key={a.title} className="neu p-6">
                <h2 className="font-display font-bold">{t(a.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(a.body)}</p>
              </div>
            ))}
          </div>

          {/* The training data */}
          {dataset && dataset.labeled > 0 && (
            <div className="neu p-6 sm:p-8">
              <div className="eyebrow">{t("Training data")}</div>
              <h2 className="mt-3 font-display text-2xl font-bold">{t("{n} labeled examples", { n: count(dataset.labeled) })}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {t("The original detector learned from pages collected by its crawler, each labeled with the class the fact-checkers gave it.")}
                {dataset.unlabeled > 0 && ` ${t("Another {n} collected pages were never labeled.", { n: count(dataset.unlabeled) })}`}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DATASET_CLASSES.map((c) => (
                  <div key={c} className="neu-inset rounded-xl p-4">
                    <div className="text-xl font-semibold tabular-nums">{count(dataset.byClass[c])}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: CLASS_META[c].color }} />
                      {t(CLASS_META[c].label)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How a check works today */}
          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">{t("How a check works")}</div>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              {[
                t("<b>1. Your text</b>: pasted, read from a link on the server, or read from a screenshot on your device."),
                t("<b>2. The archive</b>: the rare words in your text are matched against every fact-check, so a claim that was debunked before is found even when it is worded differently."),
                t("<b>3. The verdict</b>: comes from the trained detection model when it is connected. Until then, the closest matching fact-check decides, and a simple keyword check covers texts with no match; the result says which one answered."),
              ].map((line) => (
                <li key={line}>{rich(line, { b: (s) => <span className="font-semibold text-ink">{s}</span> })}</li>
              ))}
            </ol>
          </div>

          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">{t("Limits")}</div>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-muted">
              {LIMITS.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-ink-faint">•</span>
                  {t(l)}
                </li>
              ))}
            </ul>
          </div>

          <div className="neu p-6 sm:p-8">
            <div className="eyebrow">{t("about.research.eyebrow")}</div>
            <h2 className="mt-3 font-display text-2xl font-bold">{t("about.research.title")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{t("about.research.body")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/detector" className="btn-primary px-6 py-3 text-sm">
                {t("about.tryDetector")}
              </Link>
              <Link href="/blog" className="neu-btn px-6 py-3 text-sm font-medium">
                {t("Browse the archive →")}
              </Link>
            </div>
          </div>

          <div className="neu-inset flex flex-col items-start justify-between gap-3 p-6 text-sm sm:flex-row sm:items-center">
            <span className="text-ink-muted">{t("about.contactLine")}</span>
            <a href="mailto:syyhoaxanalyzer@gmail.com" className="font-medium text-brand-to hover:underline">
              syyhoaxanalyzer@gmail.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
