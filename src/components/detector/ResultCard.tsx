"use client";

import Link from "next/link";
import type { DetectionResult } from "@/lib/detect";
import { VERDICT_META } from "@/lib/verdict";
import { LANG_LABEL } from "@/lib/language";
import { formatDate, sourceName } from "@/lib/sources";
import { useI18n } from "@/lib/i18n";
import { CopyButton } from "@/components/ui/CopyButton";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { ShareBar } from "@/components/article/ShareBar";

function Gauge({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative grid h-32 w-32 shrink-0 place-items-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--shadow-dark)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-3xl font-bold" style={{ color }}>{pct}%</div>
        <div className="text-[10px] uppercase tracking-wide text-ink-faint">hoax</div>
      </div>
    </div>
  );
}

export function ResultCard({ result }: { result: DetectionResult }) {
  const { t } = useI18n();
  const m = VERDICT_META[result.verdict];
  const pct = Math.round(result.hoaxProbability * 100);
  const related = result.related ?? [];
  const top = related[0];

  const shareText = top
    ? `This looks like a known claim. ${VERDICT_META[top.verdict].labelEn}: ${top.title}`
    : `Hoax Analyzer says: ${m.labelEn} (${pct}% hoax probability). Check a message yourself:`;

  return (
    <div className="neu animate-fade-up overflow-hidden p-0">
      {/* Header band */}
      <div
        className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${m.color} 12%, transparent), transparent)` }}
      >
        <div className="flex items-center gap-5">
          <Gauge value={result.hoaxProbability} color={m.color} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">{t("res.verdict")}</div>
            <div className="mt-1 font-display text-3xl font-bold" style={{ color: m.color }}>
              {m.labelEn}
            </div>
            <div className="mt-1 text-sm text-ink-muted">{result.category}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip label={t("res.language")} value={LANG_LABEL[result.language]} />
          <Chip label={t("res.confidence")} value={`${Math.round(result.confidence * 100)}%`} />
        </div>
      </div>

      {/* Matches from our own archive: the most useful answer when the claim was checked before */}
      {related.length > 0 && (
        <div className="border-y border-hairline bg-surface-sunken/60 px-6 py-5 sm:px-8">
          <h4 className="eyebrow">Already fact-checked</h4>
          <p className="mt-1 text-xs text-ink-faint">
            Past fact-checks that share key words with your text. Open one to see what the fact-checkers found.
          </p>
          <ul className="mt-3 space-y-2">
            {related.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/blog/${a.slug}`}
                  className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-raised p-3 transition-colors hover:border-ink"
                >
                  <VerdictBadge verdict={a.verdict} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug text-ink">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Body */}
      <div className="grid gap-6 p-6 pt-6 sm:p-8 md:grid-cols-[1.5fr_1fr]">
        <div>
          <h4 className="eyebrow">{t("res.explanation")}</h4>
          <p className="mt-3 text-sm leading-relaxed text-ink">{result.explanation}</p>

          {result.signals.length > 0 && (
            <div className="mt-5">
              <h4 className="eyebrow">{t("res.signals")}</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.signals.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"
                    style={{
                      color: s.kind === "risk" ? "var(--hoax)" : "var(--valid)",
                      background: `color-mix(in srgb, ${s.kind === "risk" ? "var(--hoax)" : "var(--valid)"} 12%, transparent)`,
                      borderColor: "transparent",
                    }}
                  >
                    <span className="text-[10px]">{s.kind === "risk" ? "▲" : "✓"}</span>
                    {s.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-faint">{t("res.signalsLegend")}</p>
            </div>
          )}

          {result.simulated && (
            <div className="mt-5 rounded-xl border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-3 text-xs leading-relaxed text-ink-muted">
              <strong className="text-verdict-warn">{t("res.demoTag")}</strong> {t("res.demoNote")}
            </div>
          )}
        </div>

        <div>
          <h4 className="eyebrow">{t("res.references")}</h4>
          <ul className="mt-3 space-y-2.5">
            {result.references.map((ref, i) => (
              <li key={i} className="neu-inset rounded-xl p-3.5">
                <a
                  href={ref.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-ink transition-colors hover:text-brand-to"
                >
                  {ref.title}
                </a>
                <div className="mt-1 text-xs text-ink-faint">{ref.source}</div>
                {ref.snippet && <p className="mt-1.5 text-xs text-ink-muted">{ref.snippet}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-hairline px-6 py-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:px-8">
        <span>
          Model: <span className="text-ink-muted">{result.model}</span> · {t("res.footer")}{" "}
          <Link href="/disclaimer" className="underline hover:text-ink">
            Terms
          </Link>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <ShareBar text={shareText} url={top ? `/blog/${top.slug}` : "/detector"} label="Share" />
          <CopyButton
            text={
              `Hoax Analyzer\n` +
              `${t("res.verdict")}: ${m.labelEn}\n` +
              `${pct}% hoax\n` +
              `${t("res.confidence")}: ${Math.round(result.confidence * 100)}%\n` +
              `${t("res.explanation")}: ${result.explanation}`
            }
          />
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-inset rounded-xl px-4 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
