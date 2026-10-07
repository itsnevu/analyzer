"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import type { LabResult } from "@/lib/detect-lab";
import { clsx } from "@/lib/clsx";
import { METHODS, type Method } from "@/lib/similarity";
import { formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";

const LANGS = [
  { code: "auto", name: "Auto-detect" },
  { code: "id", name: "Indonesian" },
  { code: "en", name: "English" },
  { code: "ms", name: "Malay" },
] as const;
type LangChoice = (typeof LANGS)[number]["code"];
const LIMITS = [10, 25, 50] as const;
const HISTORY_KEY = "admin:detect-lab:history";
const HISTORY_SIZE = 5;

interface Run {
  text: string;
  lang: LangChoice;
  method: Method;
  limit: number;
  at: string;
}

const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-muted";
const ms = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

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

export function DetectLab({ stopwords, modelConfigured }: { stopwords: Record<string, number>; modelConfigured: boolean }) {
  const [text, setText] = useState("");
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
      if (!res.ok) throw new Error(json.error ?? "The lab run failed.");
      setResult(json as LabResult);
      remember(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The lab run failed.");
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

  const stopwordNote =
    lang === "auto"
      ? `Stopwords in Settings: ${["id", "en", "ms"].map((l) => `${stopwords[l] ?? 0} ${LANGS.find((x) => x.code === l)?.name}`).join(", ")}.`
      : `${stopwords[lang] ?? 0} ${LANGS.find((x) => x.code === lang)?.name} stopwords in Settings${(stopwords[lang] ?? 0) === 0 ? " (a built-in list is used instead)" : ""}.`;

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="neu space-y-4 p-6">
        <label className="block">
          <span className={labelCls}>Text or a single link</span>
          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a forwarded message, a headline, or one https:// link…"
            className={clsx(field, "resize-y font-mono text-xs leading-relaxed")}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Language (stopword list)</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as LangChoice)} className={field}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Show top</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={field}>
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n} matches
                </option>
              ))}
            </select>
          </label>
          <p className="self-end text-xs text-ink-faint">{stopwordNote}</p>
        </div>

        <fieldset>
          <legend className={labelCls}>Method</legend>
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
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{m.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
            {busy ? "Scoring…" : "Process"}
          </button>
          {!modelConfigured && <span className="text-xs text-ink-faint">No external model is configured, so the verdict card shows the site&apos;s own classifier (see Model).</span>}
        </div>

        {history.length > 0 && (
          <div className="border-t border-hairline pt-4">
            <span className={labelCls}>Recent runs (this tab)</span>
            <ul className="flex flex-wrap gap-2">
              {history.map((h) => (
                <li key={`${h.at}-${h.method}`}>
                  <button
                    type="button"
                    onClick={() => rerun(h)}
                    disabled={busy}
                    title={h.text}
                    className="neu-btn max-w-xs truncate px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    <span className="text-ink-faint">{METHODS.find((m) => m.key === h.method)?.label.split(" (")[0]} · </span>
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
  const d = result.detection;
  const m = VERDICT_META[d.verdict];
  const methodLabel = METHODS.find((x) => x.key === result.method)?.label ?? result.method;
  const stages: [string, number][] = [
    ["read page", result.timings.read],
    ["preprocess", result.timings.preprocess],
    ["candidates", result.timings.candidates],
    ["scoring", result.timings.scoring],
    ["detector", result.timings.detection],
    ["total", result.timings.total],
  ];

  return (
    <div className="space-y-4">
      <div className="neu p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">
            {result.candidates.toLocaleString("en-US")} candidates scored in {ms(result.timings.scoring)}
          </h2>
          <span className="text-xs text-ink-faint">{methodLabel}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {stages
            .filter(([, v]) => v > 0)
            .map(([k, v]) => (
              <span key={k} className="neu-inset px-3 py-1.5 text-xs">
                <span className="text-ink-faint">{k} </span>
                <span className="font-medium tabular-nums">{ms(v)}</span>
              </span>
            ))}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="inline text-ink-faint">Language: </dt>
            <dd className="inline">
              {LANGS.find((l) => l.code === result.lang)?.name}
              {result.langAuto ? ` (detected, ${pct(result.langConfidence)} sure)` : ""}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">Stopwords: </dt>
            <dd className="inline">
              {result.stopwords.count.toLocaleString("en-US")} from {result.stopwords.from === "settings" ? "Settings" : "the built-in list"}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">Input: </dt>
            <dd className="inline">
              {result.chars.toLocaleString("en-US")} characters, {result.tokens} tokens after stopwords
              {result.titlePool ? "; short, so every published title was scored too" : ""}
            </dd>
          </div>
          {result.source && (
            <div className="truncate">
              <dt className="inline text-ink-faint">Page: </dt>
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
            <span className="text-xs text-ink-faint">Rare words asked of the search index (entries containing each):</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.queryWords.map((w) => (
                <span key={w.term} className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px]">
                  {w.term} <span className="text-ink-faint">{w.docs}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {result.queryWords.length < 2 && (
          <p className="mt-3 text-xs text-verdict-warn">
            Fewer than two rare words were found, so the search index returned nothing; only the title pool (for short inputs) could be scored.
          </p>
        )}
      </div>

      <div className="neu overflow-hidden p-0">
        <div
          className="flex flex-wrap items-center gap-5 px-6 py-5"
          style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${m.color} 12%, transparent), transparent)` }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">Detector verdict</div>
            <div className="mt-1 font-display text-2xl font-bold" style={{ color: m.color }}>
              {m.labelEn}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">{d.category}</div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Chip label="Engine" value={d.model} />
            <Chip label="Hoax probability" value={pct(d.hoaxProbability)} />
            <Chip label="Confidence" value={pct(d.confidence)} />
            <Chip label="Mode" value={d.simulated ? "demo" : d.engine} />
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
          {d.fallbackReason && <p className="text-xs text-verdict-warn">The model could not be used ({d.fallbackReason}); the demo heuristic answered instead.</p>}
        </div>
      </div>

      <div className="neu overflow-hidden p-0">
        {result.matches.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">No candidate shares anything with the text.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3">#</th>
                  <th className="px-2 py-3">Score</th>
                  <th className="px-2 py-3">Verdict</th>
                  <th className="px-2 py-3">Title</th>
                  <th className="px-2 py-3">Source</th>
                  <th className="px-2 py-3">Date</th>
                  <th className="px-4 py-3">Shared words</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {result.matches.map((r) => (
                  <tr key={r.slug} className="align-top">
                    <td className="px-4 py-3 tabular-nums text-ink-faint">{r.rank}</td>
                    <td className="px-2 py-3">
                      <span className="font-semibold tabular-nums">{pct(r.score)}</span>
                      {r.bm25Rank !== undefined && <span className="block text-[10px] text-ink-faint">bm25 #{r.bm25Rank}</span>}
                    </td>
                    <td className="px-2 py-3">
                      <VerdictBadge verdict={r.verdict} />
                    </td>
                    <td className="max-w-md px-2 py-3">
                      <Link href={`/admin/articles/${r.slug}/edit`} className="font-medium leading-snug hover:text-brand">
                        {r.title}
                      </Link>{" "}
                      <Link href={`/blog/${r.slug}`} target="_blank" className="text-ink-faint hover:text-ink" title="Open on the site">
                        ↗
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-xs text-ink-muted">{r.sourceSite ? sourceName(r.sourceSite) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-muted">{formatDate(r.date) || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.shared.map((w) => (
                          <span key={w} className="rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-[11px]">
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
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
