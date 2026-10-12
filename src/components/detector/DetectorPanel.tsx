"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DetectionResult, Verdict } from "@/lib/detect";
import { detectLanguage } from "@/lib/language";
import { VERDICT_META } from "@/lib/verdict";
import { LANGUAGE_LABEL, VERDICT_LABEL } from "@/lib/verdict-labels";
import { siteLocale } from "@/lib/site-lang";
import { useI18n } from "@/lib/i18n";
import { takePendingText } from "@/lib/pending";
import { isImage, readImageText } from "@/lib/ocr";
import { ResultCard } from "./ResultCard";
import { usageMeta } from "@/lib/usage-client";
import { clsx } from "@/lib/clsx";
import { ImageIcon, LinkIcon, TextIcon } from "@/components/ui/Icons";

const HISTORY_KEY = "hoax-analyzer:history";
const MIN_CHARS = 15;
const MAX_CHARS = 20000;

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

type Mode = "text" | "link" | "screenshot";

const MODES: { key: Mode; labelKey: string; Icon: typeof TextIcon }[] = [
  { key: "text", labelKey: "det.mode.text", Icon: TextIcon },
  { key: "link", labelKey: "det.mode.link", Icon: LinkIcon },
  { key: "screenshot", labelKey: "det.mode.screenshot", Icon: ImageIcon },
];

export function DetectorPanel() {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [analyzed, setAnalyzed] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // Keyboard hint: ⌘ on Apple devices, Ctrl elsewhere (false while rendering on the server).
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/i.test(navigator.userAgent),
    () => false,
  );
  const [ocr, setOcr] = useState<{ progress: number; status: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Whether the box holds text read from a screenshot, for the mode chips.
  const [fromShot, setFromShot] = useState(false);
  // How the current text got into the box, for the research log.
  const via = useRef("typed");
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only storage after hydration */
  useEffect(() => {
    // History is a per-browser convenience only.
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* storage unavailable */
    }
    // Text pasted on the home page, or shared to the installed app from another app.
    const pending = takePendingText();
    if (pending) {
      setText(pending.text);
      via.current = pending.from;
      if (pending.run && pending.text.trim().length >= MIN_CHARS) void analyze(pending.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const live = useMemo(() => {
    if (text.trim().length < 8) return null;
    return detectLanguage(text);
  }, [text]);

  const chars = text.length;
  const isLink = /^https?:\/\/\S+$/i.test(text.trim());
  const missing = isLink ? 0 : Math.max(0, MIN_CHARS - text.trim().length);
  const canSubmit = missing === 0 && !loading;
  const mode: Mode = isLink ? "link" : fromShot && text ? "screenshot" : "text";
  const short = chars > 0 && missing > 0;

  // What a screen reader hears when a check starts and when its verdict arrives.
  const announcement = loading
    ? t("det.analyzing")
    : result
      ? t("Result ready: {verdict}, hoax probability {pct}%.", {
          verdict: t(VERDICT_LABEL[result.verdict]),
          pct: Math.round(result.hoaxProbability * 100),
        })
      : "";

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

  /** Reads a screenshot on this device and puts its text in the box. */
  async function readScreenshot(file: File) {
    setError(null);
    setNotice(null);
    setOcr({ progress: 0, status: "loading" });
    try {
      const found = await readImageText(file, (progress, status) => setOcr({ progress, status }));
      if (found.replace(/\s+/g, "").length < 10) {
        setError(t("No readable text was found in that image."));
        return;
      }
      setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${found}` : found));
      via.current = "screenshot";
      setFromShot(true);
      setNotice(t("Text read from your screenshot. Check it for reading mistakes, then press the button to analyze it."));
    } catch (e) {
      // The OCR engine's own message is technical; the detail goes to the console.
      console.error("[ocr]", e);
      setError(t("The screenshot could not be read."));
    } finally {
      setOcr(null);
    }
  }

  function takeImage(files: FileList | null | undefined): boolean {
    const file = files ? Array.from(files).find((f) => isImage(f)) : undefined;
    if (!file) return false;
    void readScreenshot(file);
    return true;
  }

  async function analyze(input = text) {
    const single = /^https?:\/\/\S+$/i.test(input.trim());
    if ((!single && input.trim().length < MIN_CHARS) || loading || ocr) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, meta: usageMeta(via.current) }),
      });
      const data = await res.json();
      // The API words its errors in the visitor's language (it reads the same cookie).
      if (!res.ok) throw new Error(data.error ?? t("Something went wrong. Please try again."));
      setResult(data as DetectionResult);
      setAnalyzed(input);
      saveHistory(input, data as DetectionResult);
      // On a phone the result renders below the fold; bring it into view.
      requestAnimationFrame(() => {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      });
    } catch (e) {
      // Only the API's own message is shown as it is; a network failure (TypeError) or an unreadable answer has the browser's English text.
      setError(
        e instanceof TypeError
          ? t("The check could not reach the server. Check your connection and try again.")
          : e instanceof Error && e.name === "Error"
            ? e.message
            : t("Something went wrong. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setResult(null);
    setError(null);
    setFromShot(false);
    via.current = "typed";
    boxRef.current?.focus();
  }

  const ocrPct = ocr ? Math.round((ocr.status === "recognizing text" ? 0.3 + ocr.progress * 0.7 : ocr.progress * 0.3) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Spoken status for screen readers: "Analyzing…", then the verdict. */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {/* Input card */}
      <div className="neu relative p-4 shadow-neu-lg sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">{t("det.tool.title")}</h2>
            <ul aria-label={t("det.mode.label")} className="flex flex-wrap gap-1.5">
              {MODES.map(({ key, labelKey, Icon }) => {
                const active = mode === key;
                return (
                  <li
                    key={key}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active ? "border-brand/40 bg-brand/10 text-brand" : "border-hairline text-ink-faint",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {t(labelKey)}
                    {active && <span className="sr-only"> {t("(detected)")}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden text-ink-faint sm:inline">{t("det.langDetected")}</span>
            <span
              className={clsx(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                live ? "bg-brand-gradient text-surface" : "bg-surface-sunken text-ink-faint",
              )}
            >
              {live ? t(LANGUAGE_LABEL[live.lang]) : "…"}
            </span>
          </div>
        </div>

        {/* Drop zone: the text box plus a visible screenshot strip */}
        <div
          className={clsx(
            "relative rounded-xl border-2 border-dashed bg-surface-sunken transition-colors focus-within:border-brand/50",
            dragging ? "border-brand bg-brand/5" : "border-hairline",
          )}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.items).some((i) => i.type.startsWith("image/"))) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            setDragging(false);
            if (takeImage(e.dataTransfer.files)) e.preventDefault();
          }}
        >
          <label htmlFor="detector-input" className="sr-only">
            {t("det.input")}
          </label>
          <textarea
            id="detector-input"
            ref={boxRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) {
                via.current = "typed";
                setFromShot(false);
              }
            }}
            onPaste={(e) => {
              if (takeImage(e.clipboardData.files)) e.preventDefault();
              else via.current = "paste";
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void analyze();
              }
            }}
            placeholder={t("det.placeholder")}
            rows={7}
            maxLength={MAX_CHARS}
            aria-describedby="detector-hint"
            className="block min-h-[10rem] w-full resize-y rounded-t-xl bg-transparent p-4 text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint sm:text-sm"
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed border-hairline px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-raised text-brand" aria-hidden>
              <ImageIcon />
            </span>
            {/* A minimum basis keeps the copy readable: on a narrow phone the button wraps under it instead of squeezing it */}
            <span className="min-w-0 flex-1 basis-48 text-xs leading-snug">
              <span className="block font-medium text-ink">{t("det.drop.title")}</span>
              <span className="block text-ink-faint">{t("det.drop.body")}</span>
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(ocr)}
              className="neu-btn inline-flex items-center gap-1.5 bg-surface-raised px-3 py-1.5 text-xs font-medium"
            >
              {t("det.drop.choose")}
            </button>
          </div>

          {dragging && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-surface-sunken/90 text-sm font-medium text-brand">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {t("det.drop.active")}
              </span>
            </div>
          )}

          {ocr && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-surface-sunken/95 p-4 text-center">
              <div className="w-full max-w-[14rem]">
                <div className="text-sm font-medium text-ink">{t("Reading your screenshot…")}</div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-hairline"
                  role="progressbar"
                  aria-label={t("Reading your screenshot")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={ocrPct}
                >
                  <div className="h-full bg-brand transition-all motion-reduce:transition-none" style={{ width: `${ocrPct}%` }} />
                </div>
                <div className="mt-2 text-xs text-ink-faint">{t("The first time downloads about 4 MB of language data.")}</div>
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            takeImage(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="meta-label pr-0.5">{t("det.samples")}</span>
            {SAMPLES.map((s) => (
              <button
                key={s.labelKey}
                type="button"
                onClick={() => {
                  setText(s.text);
                  setFromShot(false);
                  via.current = "sample";
                }}
                className="neu-btn px-3 py-1.5 text-xs font-medium text-ink-muted"
              >
                {t(s.labelKey)}
              </button>
            ))}
            {text && (
              <button type="button" onClick={reset} className="px-2 py-1.5 text-xs font-medium text-ink-faint underline-offset-2 hover:text-ink hover:underline">
                {t("det.clear")}
              </button>
            )}
          </div>
          <span className={clsx("text-xs tabular-nums", short ? "text-verdict-warn" : "text-ink-faint")}>
            {chars.toLocaleString(siteLocale(lang))}
            <span className="text-ink-faint"> / {MAX_CHARS.toLocaleString(siteLocale(lang))}</span> {t("det.chars")}
          </span>
        </div>

        {/* On a phone the button stays in reach while the box is on screen. */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-5 bg-gradient-to-t from-surface-raised from-70% to-surface-raised/0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:bg-none sm:p-0">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!canSubmit}
            aria-describedby="detector-hint"
            className={clsx(
              "btn-primary w-full py-4 text-base",
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
                <kbd className="hidden rounded border border-surface-raised/30 bg-surface-raised/10 px-1.5 py-0.5 text-[10px] font-semibold sm:inline">
                  {mac ? "⌘ ↵" : "Ctrl ↵"}
                </kbd>
              </span>
            )}
          </button>
        </div>
        <p id="detector-hint" className={clsx("mt-2 text-center text-xs", short ? "text-verdict-warn" : "text-ink-faint")}>
          {isLink
            ? t("Link detected: we will read the page and check its text.")
            : chars > 0 && missing > 0
              ? missing === 1
                ? t("Add 1 more character to analyze.")
                : t("Add {n} more characters to analyze.", { n: missing })
              : chars === 0
                ? t("Paste at least {n} characters, a link, or a screenshot.", { n: MIN_CHARS })
                : t("Tip: press {keys} to analyze.", { keys: mac ? "⌘ + Enter" : "Ctrl + Enter" })}
        </p>
        <p className="mt-1 text-center text-xs text-ink-faint">
          {t("Every check is recorded for research on how this tool is used, with your IP address, network and device. Don't paste private information.")}{" "}
          <a href="/privacy" className="underline hover:text-ink">
            {t("Privacy")}
          </a>
        </p>

        {notice && (
          <p role="status" className="mt-4 rounded-xl border border-verdict-valid/30 bg-verdict-valid/10 px-4 py-3 text-sm text-ink">
            {notice}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-3 text-sm text-verdict-hoax">
            {error}
          </p>
        )}
      </div>

      {/* Recent checks (per-browser history), as compact chips */}
      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("det.recent")}>
          <span className="meta-label pr-1">{t("det.recent")}</span>
          {history.map((h) => {
            const meta = VERDICT_META[h.verdict];
            return (
              <button
                key={h.ts}
                type="button"
                title={h.excerpt}
                onClick={() => {
                  setText(h.text);
                  via.current = "history";
                  setFromShot(false);
                  setResult(null);
                  setError(null);
                }}
                className="neu-btn inline-flex min-w-0 max-w-full items-center gap-2 bg-surface-raised py-1.5 pl-2 pr-3 text-xs"
              >
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
                >
                  {Math.round(h.hoaxProbability * 100)}%
                </span>
                <span className="sr-only">{t(VERDICT_LABEL[h.verdict])}: </span>
                <span className="min-w-0 max-w-[13rem] truncate text-ink-muted sm:max-w-[18rem]">{h.excerpt}</span>
              </button>
            );
          })}
          <button type="button" onClick={clearHistory} className="px-2 py-1.5 text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline">
            {t("det.clearHistory")}
          </button>
        </div>
      )}

      {/* Loading skeleton, then the result */}
      <div ref={resultRef} className="scroll-mt-28">
        {loading && !result && <ResultSkeleton />}
        {result && <ResultCard result={result} text={analyzed} />}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Mirrors the result card's layout, so nothing jumps when the verdict arrives. */
function ResultSkeleton() {
  return (
    <div className="neu overflow-hidden p-0" aria-hidden>
      <div className="flex flex-col-reverse items-center gap-6 bg-surface-sunken/50 p-6 sm:flex-row sm:justify-between sm:p-8">
        <div className="w-full space-y-3 sm:w-auto">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-3 w-32" />
          <div className="flex gap-2 pt-2">
            <div className="skeleton h-12 w-24 rounded-xl" />
            <div className="skeleton h-12 w-24 rounded-xl" />
            <div className="skeleton h-12 w-28 rounded-xl" />
          </div>
        </div>
        <div className="skeleton h-24 w-44 rounded-t-full" />
      </div>
      <div className="space-y-3 border-t border-hairline p-6 sm:p-8">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-4/5" />
        <div className="grid gap-3 pt-4 sm:grid-cols-2">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
