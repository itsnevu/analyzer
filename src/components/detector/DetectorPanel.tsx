"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DetectionResult, Verdict } from "@/lib/detect";
import { detectLanguage, LANG_LABEL } from "@/lib/language";
import { VERDICT_META } from "@/lib/verdict";
import { useI18n } from "@/lib/i18n";
import { takePendingText } from "@/lib/pending";
import { ResultCard } from "./ResultCard";
import { clsx } from "@/lib/clsx";

const HISTORY_KEY = "hoax-analyzer:history";
const MIN_CHARS = 15;

interface HistoryItem {
  text: string;
  excerpt: string;
  verdict: Verdict;
  hoaxProbability: number;
  ts: number;
}

const SAMPLES = [
  {
    labelKey: "det.sample.hoaxId",
    text: "VIRAL!! SEBARKAN SEBANYAK-BANYAKNYA sebelum dihapus!! Pemerintah menutupi fakta bahwa air rebusan ini 100% menyembuhkan segala penyakit. Dokter tidak mau kamu tahu rahasia ini. WAJIB TAHU!!!",
  },
  {
    labelKey: "det.sample.credId",
    text: "Menurut juru bicara Kementerian Kesehatan, data resmi menunjukkan kasus menurun dalam sepekan terakhir. Penelitian yang dipublikasikan di jurnal terkait mendukung temuan tersebut.",
  },
  {
    labelKey: "det.sample.hoaxEn",
    text: "SHOCKING! Share before it's deleted! Doctors hate this one miracle cure that the government doesn't want you to know about. Wake up people!",
  },
];

export function DetectorPanel() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [analyzed, setAnalyzed] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mac, setMac] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // History is a per-browser convenience only.
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* storage unavailable */
    }
    setMac(/Mac|iPhone|iPad/i.test(navigator.userAgent));
    // Text pasted on the home page, or shared to the installed app from another app.
    const pending = takePendingText();
    if (pending) {
      setText(pending.text);
      if (pending.run && pending.text.trim().length >= MIN_CHARS) void analyze(pending.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useMemo(() => {
    if (text.trim().length < 8) return null;
    return detectLanguage(text);
  }, [text]);

  const chars = text.length;
  const missing = Math.max(0, MIN_CHARS - text.trim().length);
  const canSubmit = missing === 0 && !loading;

  function saveHistory(txt: string, r: DetectionResult) {
    const item: HistoryItem = {
      text: txt,
      excerpt: txt.slice(0, 90),
      verdict: r.verdict,
      hoaxProbability: r.hoaxProbability,
      ts: Date.now(),
    };
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.text !== txt)].slice(0, 5);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }

  async function analyze(input = text) {
    if (input.trim().length < MIN_CHARS || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error.");
      setResult(data as DetectionResult);
      setAnalyzed(input);
      saveHistory(input, data as DetectionResult);
      // On a phone the result renders below the fold; bring it into view.
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="neu p-5 sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="eyebrow">{t("det.input")}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden text-ink-faint sm:inline">{t("det.langDetected")}</span>
            <span
              className={clsx(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                live ? "bg-brand-gradient text-white" : "shadow-neu-inset-sm text-ink-faint",
              )}
            >
              {live ? LANG_LABEL[live.lang] : "…"}
            </span>
          </div>
        </div>

        <div className="neu-inset p-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void analyze();
              }
            }}
            placeholder={t("det.placeholder")}
            rows={7}
            maxLength={20000}
            className="w-full resize-none rounded-xl bg-transparent p-4 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.labelKey}
                onClick={() => setText(s.text)}
                className="neu-btn px-3 py-1.5 text-xs font-medium text-ink-muted"
              >
                {t(s.labelKey)}
              </button>
            ))}
            {text && (
              <button
                onClick={() => { setText(""); setResult(null); setError(null); }}
                className="px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink"
              >
                {t("det.clear")}
              </button>
            )}
          </div>
          <span className={clsx("text-xs", chars > 0 && missing > 0 ? "text-verdict-warn" : "text-ink-faint")}>
            {chars.toLocaleString("en-US")} {t("det.chars")}
          </span>
        </div>

        <button
          onClick={() => void analyze()}
          disabled={!canSubmit}
          aria-describedby="detector-hint"
          className={clsx(
            "btn-primary mt-5 w-full py-4 text-base",
            !canSubmit && "cursor-not-allowed opacity-50 hover:opacity-50",
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> {t("det.analyzing")}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {t("det.submit")}
              <kbd className="hidden rounded border border-white/20 bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold sm:inline">
                {mac ? "⌘ ↵" : "Ctrl ↵"}
              </kbd>
            </span>
          )}
        </button>
        <p id="detector-hint" className={clsx("mt-2 text-center text-xs", chars > 0 && missing > 0 ? "text-verdict-warn" : "text-ink-faint")}>
          {chars > 0 && missing > 0
            ? `Add ${missing} more ${missing === 1 ? "character" : "characters"} to analyze.`
            : chars === 0
              ? `Paste at least ${MIN_CHARS} characters.`
              : `Tip: press ${mac ? "⌘" : "Ctrl"} + Enter to analyze.`}
        </p>
        <p className="mt-1 text-center text-xs text-ink-faint">
          Checked text is saved with its verdict, without your IP address, to improve the detector. Don&apos;t paste private information.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-3 text-sm text-verdict-hoax">
            {error}
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !result && <ResultSkeleton />}

      {/* Result */}
      <div ref={resultRef} className="scroll-mt-24">
        {result && <ResultCard result={result} text={analyzed} />}
      </div>

      {/* Recent checks (per-browser history) */}
      {history.length > 0 && (
        <div className="neu p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="eyebrow">{t("det.recent")}</span>
            <button onClick={clearHistory} className="text-xs text-ink-faint hover:text-ink">
              {t("det.clearHistory")}
            </button>
          </div>
          <ul className="space-y-2">
            {history.map((h) => {
              const meta = VERDICT_META[h.verdict];
              return (
                <li key={h.ts}>
                  <button
                    onClick={() => { setText(h.text); setResult(null); setError(null); }}
                    className="neu-inset flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:text-ink"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold"
                      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
                    >
                      {Math.round(h.hoaxProbability * 100)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{h.excerpt}…</span>
                    <span className="shrink-0 text-xs font-medium" style={{ color: meta.color }}>{meta.labelEn}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ResultSkeleton() {
  return (
    <div className="neu p-8">
      <div className="flex items-center gap-5">
        <div className="h-32 w-32 rounded-full bg-surface-sunken shadow-neu-inset" />
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-surface-sunken" />
          <div className="h-8 w-40 rounded bg-surface-sunken" />
          <div className="h-3 w-32 rounded bg-surface-sunken" />
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-3 w-full rounded bg-surface-sunken" />
        <div className="h-3 w-11/12 rounded bg-surface-sunken" />
        <div className="h-3 w-4/5 rounded bg-surface-sunken" />
      </div>
    </div>
  );
}
