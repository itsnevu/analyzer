"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { REPORT_DRAFT_KEY, type ReportDraft } from "@/lib/report-labels";
import type { DetectionResult } from "@/lib/detect";
import { VERDICT_META } from "@/lib/verdict";
import { DETECTOR_CATEGORIES, DETECTOR_SIGNALS, LANGUAGE_LABEL, VERDICT_LABEL } from "@/lib/verdict-labels";
import { formatDate, hostOf, sourceName } from "@/lib/sources";
import type { SiteT } from "@/lib/site-lang";
import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";
import { CopyButton } from "@/components/ui/CopyButton";
import { VerdictGauge } from "@/components/ui/VerdictGauge";
import { ExternalIcon, FlagIcon } from "@/components/ui/Icons";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { ShareBar } from "@/components/article/ShareBar";
import { HighlightedText } from "./HighlightedText";
import { ResearchCard } from "./ResearchCard";

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="eyebrow">{children}</h3>;
}

/**
 * A signal's label in the site language. The API keeps them in English (the
 * highlighter matches on them); the trained classifier's cues read
 * "word: vaksin", the heuristic's are the matched words themselves.
 */
function signalLabel(label: string, t: SiteT): string {
  const cue = /^(word|phrase): (.+)$/.exec(label);
  if (cue) return cue[1] === "word" ? t("word: {cue}", { cue: cue[2] }) : t("phrase: {cue}", { cue: cue[2] });
  return DETECTOR_SIGNALS.includes(label) ? t(label) : label;
}

export function ResultCard({ result, text }: { result: DetectionResult; text: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const m = VERDICT_META[result.verdict];
  const verdictLabel = t(VERDICT_LABEL[result.verdict]);
  // The site's own sentences come as keys; an external model's explanation is shown as it is.
  const explanation = result.explanationParts?.length ? result.explanationParts.map((p) => t(p.key, p.vars)).join(" ") : result.explanation;
  const category = result.category && DETECTOR_CATEGORIES.includes(result.category) ? t(result.category) : result.category;
  // The local engines attach the site's standard references, whose texts are translated; a model's are shown as they are.
  const own = result.engine !== "external";
  const pct = Math.round(result.hoaxProbability * 100);
  const confidence = Math.round(result.confidence * 100);
  const related = result.related ?? [];
  const top = related[0];
  const engineKey = `res.engine.${result.engine}`;
  const engine = t(engineKey) === engineKey ? result.engine : t(engineKey);
  const risks = result.signals.filter((s) => s.kind === "risk");

  function reportWrong() {
    const draft: ReportDraft = { reportType: "wrong-result", content: text, detectedVerdict: `${m.labelEn} (${pct}% hoax)` };
    try {
      sessionStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable; the form opens empty */
    }
    router.push("/report");
  }

  const shareText = top
    ? t("This looks like a known claim. {verdict}: {title}", { verdict: t(VERDICT_LABEL[top.verdict]), title: top.title })
    : t("Hoax Analyzer says: {verdict} ({pct}% hoax probability). Check a message yourself:", { verdict: verdictLabel, pct });

  return (
    <article aria-labelledby="result-verdict" className="neu animate-fade-up overflow-hidden p-0 shadow-neu-lg motion-reduce:animate-none">
      {/* Verdict hero */}
      <div className="verdict-wash p-6 sm:p-8" style={{ "--verdict": m.color } as React.CSSProperties}>
        <div className="flex flex-col-reverse items-center gap-6 sm:flex-row sm:justify-between">
          <div className="w-full min-w-0 text-center sm:w-auto sm:text-left">
            <div className="meta-label">{t("res.verdict")}</div>
            <h2 id="result-verdict" className="mt-1 break-words font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-6xl" style={{ color: m.color }}>
              {verdictLabel}
            </h2>
            <div className="mt-3 flex justify-center gap-1.5 sm:justify-start" aria-hidden>
              {["#45b6ad", "#ce4b77", "#e4a149", "#8b8b3c"].map((c) => (
                <span key={c} className="h-1.5 w-8 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
            {category && <p className="mt-2 text-sm text-ink-muted">{category}</p>}
            <dl className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Stat label={t("res.confidence")} value={`${confidence}%`} />
              <Stat label={t("res.language")} value={t(LANGUAGE_LABEL[result.language])} />
              <Stat label={t("res.engine")} value={engine} />
            </dl>
          </div>
          <VerdictGauge value={result.hoaxProbability} color={m.color} size="lg" label={t("res.hoaxProbability")} caption={t("res.hoaxProbability")} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-y border-hairline bg-surface-raised px-6 py-3 sm:px-8">
        <CopyButton
          text={
            `Hoax Analyzer\n` +
            `${t("res.verdict")}: ${verdictLabel}\n` +
            `${t("res.hoaxProbability")}: ${pct}%\n` +
            `${t("res.confidence")}: ${confidence}%\n` +
            `${t("res.explanation")}: ${explanation}`
          }
        />
        <ShareBar text={shareText} url={top ? `/blog/${top.slug}` : "/detector"} label={t("Share")} />
        <button
          type="button"
          onClick={reportWrong}
          className="neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-verdict-hoax sm:ml-auto"
        >
          <FlagIcon className="h-3.5 w-3.5" />
          {t("res.wrong")}
        </button>
      </div>

      {result.source && (
        <div className="border-b border-hairline px-6 py-3 text-xs text-ink-muted sm:px-8">
          {t("Read from the page")}{" "}
          <a
            href={result.source.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1 break-all font-medium text-ink hover:text-brand"
          >
            {result.source.title}
            <ExternalIcon className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}

      {/* Explanation, signals, the marked-up text */}
      <div className="space-y-8 p-6 sm:p-8">
        <section>
          <Heading>{t("res.explanation")}</Heading>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">{explanation}</p>

          {(result.simulated || result.fallbackReason) && (
            <div className="mt-4 rounded-xl border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-3 text-xs leading-relaxed text-ink-muted">
              <strong className="text-verdict-warn">{result.fallbackReason ? t("Fallback.") : t("res.demoTag")}</strong>{" "}
              {/* lib/detect gives one of two public reasons: a timeout, or any other failure. */}
              {result.fallbackReason
                ? /too long/.test(result.fallbackReason)
                  ? t("The configured detection model took too long to answer, so the site's own classifier and the fact-check archive answered instead.")
                  : t("The configured detection model could not be used right now, so the site's own classifier and the fact-check archive answered instead.")
                : t("res.demoNote")}
            </div>
          )}
        </section>

        {result.signals.length > 0 && (
          <section>
            <Heading>{t("res.signals")}</Heading>
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.signals.map((s, i) => (
                <li
                  key={i}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                    s.kind === "risk" ? "bg-verdict-hoax/10 text-verdict-hoax ring-verdict-hoax/25" : "bg-verdict-valid/10 text-verdict-valid ring-verdict-valid/25",
                  )}
                >
                  <span className="text-[10px]" aria-hidden>
                    {s.kind === "risk" ? "▲" : "✓"}
                  </span>
                  <span className="sr-only">{s.kind === "risk" ? t("Risk marker:") : t("Credibility marker:")} </span>
                  {signalLabel(s.label, t)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">{t("res.signalsLegend")}</p>
          </section>
        )}

        {!result.source && risks.length > 0 && (
          <section>
            <Heading>{t("res.highlighted")}</Heading>
            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-hairline bg-surface-sunken p-4">
              <HighlightedText text={text} signals={result.signals} />
            </div>
          </section>
        )}
      </div>

      {/* Matches from our own archive */}
      {related.length > 0 && (
        <section className="border-t border-hairline bg-surface-sunken/60 p-6 sm:p-8">
          <Heading>{t("res.matches")}</Heading>
          <p className="mt-1 text-xs text-ink-faint">{t("res.matchesIntro")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((a) => (
              <li key={a.slug} className="min-w-0">
                <Link
                  href={`/blog/${a.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-xl border border-hairline bg-surface-raised p-4 transition-colors hover:border-ink"
                >
                  <VerdictBadge verdict={a.verdict} className="self-start" />
                  <span className="line-clamp-3 font-display text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-brand">
                    {a.title}
                  </span>
                  {a.summary && <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{a.summary}</span>}
                  <span className="mt-auto truncate pt-1 text-xs text-ink-faint">
                    {[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date, "short", lang)].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* References */}
      {result.references.length > 0 && (
        <section className="border-t border-hairline p-6 sm:p-8">
          <Heading>{t("res.references")}</Heading>
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline">
            {result.references.map((ref, i) => {
              const host = hostOf(ref.url);
              return (
                <li key={i} className="p-4">
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-1.5 text-sm font-medium text-ink transition-colors hover:text-brand"
                    >
                      <span className="break-words">{own ? t(ref.title) : ref.title}</span>
                      <ExternalIcon className="mt-1 h-3 w-3 shrink-0 text-ink-faint group-hover:text-brand" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-ink">{own ? t(ref.title) : ref.title}</span>
                  )}
                  <div className="mt-1 text-xs text-ink-faint">
                    {[own ? t(ref.source) : ref.source, host && host !== ref.source ? host : ""].filter(Boolean).join(" · ")}
                  </div>
                  {ref.snippet && <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{own ? t(ref.snippet) : ref.snippet}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ResearchCard checkId={result.checkId} />

      <div className="border-t border-hairline px-6 py-4 text-xs text-ink-faint sm:px-8">
        {t("Model:")} <span className="text-ink-muted">{result.model}</span> · {t("res.footer")}{" "}
        <Link href="/disclaimer" className="underline hover:text-ink">
          {t("Terms")}
        </Link>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-raised/80 px-3.5 py-2 text-left">
      <dt className="meta-label">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
