"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { useAdminT } from "@/components/admin/AdminLang";
import { adminLocale, formatAdminNumber, tk, type AdminLang } from "@/lib/admin-lang";
import type { LabResult } from "@/lib/detect-lab";
import { clsx } from "@/lib/clsx";
import { METHODS, type Method } from "@/lib/similarity";
import { sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";

const LANGS = [
  { code: "auto", name: tk("Auto-detect") },
  { code: "id", name: tk("Indonesian") },
  { code: "en", name: tk("English") },
  { code: "ms", name: tk("Malay") },
] as const;
type LangChoice = (typeof LANGS)[number]["code"];
const LIMITS = [10, 25, 50] as const;
const HISTORY_KEY = "admin:detect-lab:history";
const HISTORY_SIZE = 5;

/** Plain-language names and descriptions of the comparison methods (lib/similarity keeps the technical ones). */
const METHOD_TEXT: Record<Method, { label: string; short: string; note: string }> = {
  archive: {
    label: tk("Archive match (BM25 + rare words)"),
    short: tk("Archive match"),
    note: tk("What the public detector uses. It looks for the text's rarest words in each entry's title and story; words found in few entries count more (BM25 ranking)."),
  },
  levenshtein: {
    label: tk("Levenshtein (word changes)"),
    short: tk("Levenshtein"),
    note: tk("Counts how many words must be added, removed or replaced to turn one text into the other. Fewer changes means more alike."),
  },
  damerau: {
    label: tk("Damerau–Levenshtein (changes + swaps)"),
    short: tk("Damerau–Levenshtein"),
    note: tk("Like Levenshtein, but swapping two neighbouring words counts as a single change."),
  },
  "smith-waterman": {
    label: tk("Smith–Waterman (shared passage)"),
    short: tk("Smith–Waterman"),
    note: tk("Finds the longest passage both texts share. Good for a forwarded message quoted inside a long article."),
  },
  jaccard: {
    label: tk("Jaccard (shared words)"),
    short: tk("Jaccard"),
    note: tk("The share of different words that appear in both texts. Word order and repeats are ignored."),
  },
  cosine: {
    label: tk("Cosine (TF-IDF)"),
    short: tk("Cosine"),
    note: tk("Compares how often each word is used in the two texts; rare words count more (TF-IDF)."),
  },
};

/** The stages of a lab run, in order, with their plain names. */
const STAGES = [
  { key: "read", label: tk("Read page") },
  { key: "preprocess", label: tk("Prepare text") },
  { key: "candidates", label: tk("Find candidates") },
  { key: "scoring", label: tk("Compare") },
  { key: "detection", label: tk("Detector") },
  { key: "total", label: tk("Total") },
] as const;

const ENGINE_NAME: Record<string, string> = {
  external: tk("External model"),
  baseline: tk("Trained model"),
  heuristic: tk("Keyword rules"),
};

interface Run {
  text: string;
  lang: LangChoice;
  method: Method;
  limit: number;
  at: string;
}

const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-sm font-medium text-ink-muted";
const ms = (n: number, lang: AdminLang) =>
  `${n < 10 ? n.toLocaleString(adminLocale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : formatAdminNumber(Math.round(n), lang)} ms`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
/** "9 Oct 2026" / "9 Okt 2026" for a "YYYY-MM-DD" date; "" when it is not one. */
const day = (date: string, lang: AdminLang) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/* The run history lives in sessionStorage (this tab only) and is read as an external store, so the server renders none and the browser its own. */
const NO_HISTORY: Run[] = [];
let historyRaw: string | null = null;
let historyList: Run[] = NO_HISTORY;
const historyListeners = new Set<() => void>();

function readHistory(): Run[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(HISTORY_KEY);
  } catch {
    /* storage unavailable; history is only a convenience */
  }
  if (raw !== historyRaw) {
    historyRaw = raw;
    try {
      const list = raw ? (JSON.parse(raw) as Run[]) : [];
      historyList = Array.isArray(list) ? list.filter((r) => r && typeof r.text === "string") : NO_HISTORY;
    } catch {
      historyList = NO_HISTORY;
    }
  }
  return historyList;
}

function writeHistory(list: Run[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  historyListeners.forEach((l) => l());
}

function subscribeHistory(listener: () => void) {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

export function DetectLab({ stopwords, modelConfigured, initialText = "" }: { stopwords: Record<string, number>; modelConfigured: boolean; initialText?: string }) {
  const { t } = useAdminT();
  const [text, setText] = useState(initialText);
  const [lang, setLang] = useState<LangChoice>("auto");
  const [method, setMethod] = useState<Method>("archive");
  const [limit, setLimit] = useState<number>(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const history = useSyncExternalStore(subscribeHistory, readHistory, () => NO_HISTORY);

  function remember(run: Run) {
    const next = [run, ...history.filter((h) => !(h.text === run.text && h.method === run.method && h.lang === run.lang))].slice(0, HISTORY_SIZE);
    writeHistory(next);
  }

  async function run(input: Run) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/detect-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.text, lang: input.lang, method: input.method, limit: input.limit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("The test could not be run."));
      setResult(json as LabResult);
      remember(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The test could not be run."));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    void run({ text, lang, method, limit, at: new Date().toISOString() });
  }

  function rerun(h: Run) {
    setText(h.text);
    setLang(h.lang);
    setMethod(h.method);
    setLimit(h.limit);
    void run(h);
  }

  const langName = t(LANGS.find((x) => x.code === lang)?.name ?? lang);
  const stopwordNote =
    lang === "auto"
      ? t("Common words skipped (stopwords, from Settings): {id} Indonesian, {en} English, {ms} Malay.", {
          id: stopwords.id ?? 0,
          en: stopwords.en ?? 0,
          ms: stopwords.ms ?? 0,
        })
      : (stopwords[lang] ?? 0) === 0
        ? t("Settings has no common words (stopwords) for {language}, so a built-in list is used.", { language: langName })
        : t("{n} common {language} words (stopwords, from Settings) are skipped.", { n: stopwords[lang] ?? 0, language: langName });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="neu space-y-4 p-6">
        <label className="block">
          <span className={labelCls}>{t("Text or a single link")}</span>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("Paste a forwarded message, a headline, or one https:// link…")}
            className={clsx(field, "resize-y leading-relaxed")}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>{t("Language of the text")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as LangChoice)} className={field}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {t(l.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t("Matches to show")}</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={field}>
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {t("Top {n}", { n })}
                </option>
              ))}
            </select>
          </label>
          <p className="self-end text-sm text-ink-faint">{stopwordNote}</p>
        </div>

        <fieldset>
          <legend className={labelCls}>{t("How to compare")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {METHODS.map((m) => (
              <label
                key={m.key}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                  method === m.key ? "border-ink bg-surface-sunken" : "border-hairline hover:bg-surface-sunken/60",
                )}
              >
                <input type="radio" name="method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} className="mt-1 accent-brand" />
                <span>
                  <span className="block text-sm font-medium">{METHOD_TEXT[m.key] ? t(METHOD_TEXT[m.key].label) : m.label}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-ink-faint">{METHOD_TEXT[m.key] ? t(METHOD_TEXT[m.key].note) : m.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
            {busy ? t("Checking…") : t("Check")}
          </button>
          {!modelConfigured && (
            <span className="text-sm text-ink-faint">{t("No external model is set up, so the verdict comes from the site's own trained model (see the Model page).")}</span>
          )}
        </div>

        {history.length > 0 && (
          <div className="border-t border-hairline pt-4">
            <span className={labelCls}>{t("Recent tests (this browser tab)")}</span>
            <ul className="flex flex-wrap gap-2">
              {history.map((h) => (
                <li key={`${h.at}-${h.method}`}>
                  <button
                    type="button"
                    onClick={() => rerun(h)}
                    disabled={busy}
                    title={h.text}
                    className="neu-btn max-w-xs truncate px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    <span className="text-ink-faint">{METHOD_TEXT[h.method] ? t(METHOD_TEXT[h.method].short) : h.method} · </span>
                    {h.text.slice(0, 48)}
                    {h.text.length > 48 ? "…" : ""}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: LabResult }) {
  const { t, lang } = useAdminT();
  const d = result.detection;
  const m = VERDICT_META[d.verdict];
  const methodLabel = METHOD_TEXT[result.method] ? t(METHOD_TEXT[result.method].label) : result.method;
  const stages = STAGES.map((s) => ({ key: s.key, label: s.label, ms: result.timings[s.key] }));

  return (
    <div className="space-y-4">
      <div className="neu p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">
            {t("{n} possible matches compared in {time}", { n: result.candidates, time: ms(result.timings.scoring, lang) })}
          </h2>
          <span className="text-sm text-ink-faint">{methodLabel}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {stages
            .filter((s) => s.ms > 0)
            .map((s) => (
              <span key={s.key} className="neu-inset px-3 py-1.5 text-sm">
                <span className="text-ink-faint">{t(s.label)} </span>
                <span className="font-medium tabular-nums">{ms(s.ms, lang)}</span>
              </span>
            ))}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="inline text-ink-faint">{t("Language:")} </dt>
            <dd className="inline">
              {t(LANGS.find((l) => l.code === result.lang)?.name ?? result.lang)}
              {result.langAuto ? ` ${t("(detected automatically, {pct} sure)", { pct: pct(result.langConfidence) })}` : ""}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">{t("Common words skipped:")} </dt>
            <dd className="inline">
              {result.stopwords.from === "settings"
                ? t("{n} from Settings", { n: result.stopwords.count })
                : t("{n} from the built-in list", { n: result.stopwords.count })}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">{t("Text:")} </dt>
            <dd className="inline">
              {t("{chars} characters, {words} words left after skipping common words", { chars: result.chars, words: result.tokens })}
              {result.titlePool ? `; ${t("short, so every published title was compared too")}` : ""}
            </dd>
          </div>
          {result.source && (
            <div className="truncate">
              <dt className="inline text-ink-faint">{t("Page:")} </dt>
              <dd className="inline">
                <a href={result.source.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-ink hover:underline">
                  {result.source.title} ↗
                </a>
              </dd>
            </div>
          )}
        </dl>
        {result.queryWords.length > 0 && (
          <div className="mt-3">
            <span className="text-sm text-ink-faint">{t("Rare words looked up in the search index (the number is how many entries contain it):")}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.queryWords.map((w) => (
                <span key={w.term} className="rounded-full border border-hairline px-2 py-0.5 font-mono text-xs">
                  {w.term} <span className="text-ink-faint">{formatAdminNumber(w.docs, lang)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {result.queryWords.length < 2 && (
          <p className="mt-3 text-sm text-verdict-warn">
            {t("Fewer than two rare words were found, so the search index returned nothing. Only titles could be compared, and only for a short text.")}
          </p>
        )}
      </div>

      <div className="neu overflow-hidden p-0">
        <div
          className="flex flex-wrap items-center gap-5 px-6 py-5"
          style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${m.color} 12%, transparent), transparent)` }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">{t("Detector verdict")}</div>
            <div className="mt-1 font-display text-2xl font-bold" style={{ color: m.color }}>
              {t(m.label)}
            </div>
            <div className="mt-0.5 text-sm text-ink-muted">{t(d.category)}</div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Chip label={t("Engine")} value={d.model} />
            <Chip label={t("Chance of hoax")} value={pct(d.hoaxProbability)} />
            <Chip label={t("Confidence")} value={pct(d.confidence)} />
            <Chip label={t("Answered by")} value={d.simulated ? t("Demo mode") : t(ENGINE_NAME[d.engine] ?? d.engine)} />
          </div>
        </div>
        <div className="space-y-3 border-t border-hairline px-6 py-4 text-sm">
          <p className="text-ink-muted">{d.explanation}</p>
          {d.signals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.signals.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    color: s.kind === "risk" ? "var(--hoax)" : "var(--valid)",
                    background: `color-mix(in srgb, ${s.kind === "risk" ? "var(--hoax)" : "var(--valid)"} 12%, transparent)`,
                  }}
                >
                  <span className="text-[10px]">{s.kind === "risk" ? "▲" : "✓"}</span>
                  {s.label}
                </span>
              ))}
            </div>
          )}
          {d.fallbackReason && (
            <p className="text-sm text-verdict-warn">
              {t("The external model could not be used ({reason}), so the simple keyword rules answered instead.", { reason: d.fallbackReason })}
            </p>
          )}
        </div>
      </div>

      <div className="neu overflow-hidden p-0">
        {result.matches.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">{t("No archive entry shares any words with this text.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3">#</th>
                  <th className="px-2 py-3">{t("Similarity")}</th>
                  <th className="px-2 py-3">{t("Verdict")}</th>
                  <th className="px-2 py-3">{t("Title")}</th>
                  <th className="px-2 py-3">{t("Source")}</th>
                  <th className="px-2 py-3">{t("Date")}</th>
                  <th className="px-4 py-3">{t("Shared words")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {result.matches.map((r) => (
                  <tr key={r.slug} className="align-top">
                    <td className="px-4 py-3 tabular-nums text-ink-faint">{r.rank}</td>
                    <td className="px-2 py-3">
                      <span className="font-semibold tabular-nums">{pct(r.score)}</span>
                      {r.bm25Rank !== undefined && <span className="block text-xs text-ink-faint">{t("BM25 rank {n}", { n: r.bm25Rank })}</span>}
                    </td>
                    <td className="px-2 py-3">
                      <VerdictBadge verdict={r.verdict} label={t(VERDICT_META[r.verdict].label)} />
                    </td>
                    <td className="max-w-md px-2 py-3">
                      <Link href={`/admin/articles/${r.slug}/edit`} className="font-medium leading-snug hover:text-brand">
                        {r.title}
                      </Link>{" "}
                      <Link href={`/blog/${r.slug}`} target="_blank" className="text-ink-faint hover:text-ink" title={t("Open on the site")}>
                        ↗
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-ink-muted">{r.sourceSite ? sourceName(r.sourceSite) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-ink-muted">{day(r.date, lang) || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.shared.map((w) => (
                          <span key={w} className="rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-xs">
                            {w}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-inset px-3.5 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
