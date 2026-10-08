"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import type { ReviewAction, ReviewItem } from "@/lib/review";
import { LANGUAGE_NAME, outboundLink, sourceName } from "@/lib/sources";
import { adminLocale, tk, type AdminLang } from "@/lib/admin-lang";
import { useAdminT } from "./AdminLang";
import { VERDICT_META } from "@/lib/verdict";

const EXCERPT_CHARS = 400;

const VERDICT_BUTTONS: { action: Exclude<ReviewAction, "delete">; key: string; label: string; color: string }[] = [
  { action: "hoax", key: "1", label: tk("Hoax"), color: VERDICT_META.hoax.color },
  { action: "misleading", key: "2", label: tk("Misleading"), color: VERDICT_META.misleading.color },
  { action: "valid", key: "3", label: tk("Credible"), color: VERDICT_META.valid.color },
];

const LABEL_NAME: Record<string, string> = {
  HOAX: tk("Hoax"),
  DISINFORMATION: tk("Disinformation"),
  FACT: tk("Fact"),
  INFORMATION: tk("Information"),
  EDUKASI: tk("Education"),
  KLARIFIKASI: tk("Clarification"),
  UNKNOWN: tk("Unknown"),
};

/** "2019-04-06" → "Apr 6, 2019" / "6 Apr 2019"; "" or junk → "". */
function dayLabel(date: string, lang: AdminLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ReviewQueue({ items, total }: { items: ReviewItem[]; total: number }) {
  const router = useRouter();
  const { t, lang } = useAdminT();
  const [removed, setRemoved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const left = items.filter((i) => !removed.includes(i.slug));
  const queue = [...left.filter((i) => !skipped.includes(i.slug)), ...skipped.map((s) => left.find((i) => i.slug === s)).filter((i): i is ReviewItem => !!i)];
  const current = queue[0];
  const remaining = Math.max(total - removed.length, left.length);

  const actRef = useRef<(action: ReviewAction | "skip") => void>(() => undefined);

  async function act(action: ReviewAction | "skip") {
    if (!current || busy) return;
    if (action === "skip") {
      setSkipped((s) => [...s.filter((x) => x !== current.slug), current.slug]);
      return;
    }
    if (action === "delete" && !confirm(t("Delete “{title}”? This cannot be undone.", { title: current.title }))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: current.slug, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("The action did not work."));
      setRemoved((r) => [...r, current.slug]);
      const label = VERDICT_BUTTONS.find((b) => b.action === action)?.label ?? "";
      setFlash(
        action === "delete"
          ? t("Deleted “{title}”.", { title: current.title })
          : t("Published “{title}” as {verdict}.", { title: current.title, verdict: t(label) }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The action did not work."));
    } finally {
      setBusy(false);
    }
  }
  // The key handler is registered once; it reads the latest `act` through the ref.
  useEffect(() => {
    actRef.current = act;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const map: Record<string, ReviewAction | "skip"> = { "1": "hoax", "2": "misleading", "3": "valid", s: "skip", d: "delete" };
      const action = map[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      actRef.current(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!current) {
    return (
      <div className="neu p-10 text-center text-sm text-ink-muted">
        {flash && <p className="mb-3 text-ink">{flash}</p>}
        {t("All done. Nothing left to review.")}{" "}
        <Link href="/admin/articles" className="text-brand hover:underline">
          {t("Back to articles →")}
        </Link>
      </div>
    );
  }

  const link = current.originalUrl ? outboundLink(current.originalUrl, current.date, current.archiveUrl || undefined) : null;
  const legacyLabel = current.label ? (LABEL_NAME[current.label] ? t(LABEL_NAME[current.label]) : current.label) : "";

  return (
    <div className="space-y-3">
      {flash && <p className="rounded-lg border border-verdict-valid/30 bg-verdict-valid/10 px-4 py-2.5 text-sm text-ink">{flash}</p>}
      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

      <article className="neu p-6" key={current.slug}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="eyebrow">{t("{n} left", { n: remaining })}</span>
            <h2 className="mt-2 font-display text-xl font-bold leading-snug text-balance">{current.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-faint">
              <span>{current.sourceSite ? sourceName(current.sourceSite) : t("No source website")}</span>
              <span>· {dayLabel(current.date, lang) || t("No date")}</span>
              <span>· {t(LANGUAGE_NAME[current.lang])}</span>
              {legacyLabel && (
                <span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-ink-muted" title={t("The label this text had in the old dataset")}>
                  {t("Old label: {label}", { label: legacyLabel })}
                </span>
              )}
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:text-brand">
                  {link.archived ? t("Saved copy ↗") : t("Original ↗")}
                </a>
              )}
            </div>
          </div>
          <Link href={`/admin/articles/${current.slug}/edit`} className="neu-btn shrink-0 px-4 py-2 text-sm">
            {t("Edit")}
          </Link>
        </div>

        <p className="mt-4 rounded-lg border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-2.5 text-sm leading-relaxed text-ink-muted">
          {t("The publisher gave no verdict, so this stays hidden until you choose one below.")}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Excerpt title={t("The claim")} text={current.narration} length={current.narrationLength} />
          <Excerpt title={t("Explanation")} text={current.explanation} length={current.explanationLength} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hairline pt-5">
          {VERDICT_BUTTONS.map((b) => (
            <button
              key={b.action}
              type="button"
              onClick={() => void act(b.action)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: b.color }}
            >
              <Key>{b.key}</Key>
              {t(b.label)}
            </button>
          ))}
          <button type="button" onClick={() => void act("skip")} disabled={busy || queue.length < 2} className={clsx("neu-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50")}>
            <Key>s</Key>
            {t("Keep hidden")}
          </button>
          <button
            type="button"
            onClick={() => void act("delete")}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
          >
            <Key>d</Key>
            {t("Delete")}
          </button>
        </div>
      </article>

      {queue.length > 1 && (
        <p className="text-sm text-ink-faint">
          {t("Next:")} <span className="text-ink-muted">{queue[1].title}</span>
        </p>
      )}
    </div>
  );
}

function Excerpt({ title, text, length }: { title: string; text: string; length: number }) {
  const { t } = useAdminT();
  return (
    <div className="min-w-0">
      <h3 className="eyebrow">{title}</h3>
      {text ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
          {text}
          {length > EXCERPT_CHARS && <span className="text-ink-faint"> … {t("({n} characters in all)", { n: length })}</span>}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">{t("Empty.")}</p>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-current/40 px-1.5 font-mono text-[11px] opacity-80">{children}</kbd>;
}
