"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import type { ReviewAction, ReviewItem } from "@/lib/review";
import { LANGUAGE_NAME, formatDate, outboundLink, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";

const EXCERPT_CHARS = 400;

const VERDICT_BUTTONS: { action: Exclude<ReviewAction, "delete">; key: string; label: string; color: string }[] = [
  { action: "hoax", key: "1", label: "Hoax", color: VERDICT_META.hoax.color },
  { action: "misleading", key: "2", label: "Misleading", color: VERDICT_META.misleading.color },
  { action: "valid", key: "3", label: "Credible", color: VERDICT_META.valid.color },
];

const LABEL_NAME: Record<string, string> = {
  HOAX: "Hoax",
  DISINFORMATION: "Disinformation",
  FACT: "Fact",
  INFORMATION: "Information",
  EDUKASI: "Education",
  KLARIFIKASI: "Clarification",
  UNKNOWN: "Unknown",
};

export function ReviewQueue({ items, total }: { items: ReviewItem[]; total: number }) {
  const router = useRouter();
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
    if (action === "delete" && !confirm(`Delete "${current.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: current.slug, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The action failed.");
      setRemoved((r) => [...r, current.slug]);
      setFlash(
        action === "delete"
          ? `Deleted "${current.title}".`
          : `Published "${current.title}" as ${VERDICT_BUTTONS.find((b) => b.action === action)?.label.toLowerCase()}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed.");
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
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
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
        Nothing left to review.{" "}
        <Link href="/admin/articles" className="text-brand hover:underline">
          Back to articles →
        </Link>
      </div>
    );
  }

  const link = current.originalUrl ? outboundLink(current.originalUrl, current.date, current.archiveUrl || undefined) : null;
  const legacyLabel = current.label ? (LABEL_NAME[current.label] ?? current.label) : "";

  return (
    <div className="space-y-3">
      {flash && <p className="rounded-lg border border-verdict-valid/30 bg-verdict-valid/10 px-4 py-2.5 text-sm text-ink">{flash}</p>}
      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

      <article className="neu p-6" key={current.slug}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="eyebrow">{remaining.toLocaleString("en-US")} left</span>
            <h2 className="mt-2 font-display text-xl font-bold leading-snug text-balance">{current.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
              <span>{current.sourceSite ? sourceName(current.sourceSite) : "No source site"}</span>
              <span>· {formatDate(current.date) || "no date"}</span>
              <span>· {LANGUAGE_NAME[current.lang]}</span>
              {legacyLabel && (
                <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted" title="Class label from the legacy dataset">
                  legacy: {legacyLabel}
                </span>
              )}
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:text-brand">
                  {link.archived ? "Archived copy" : "Original"} ↗
                </a>
              )}
            </div>
          </div>
          <Link href={`/admin/articles/${current.slug}/edit`} className="neu-btn shrink-0 px-4 py-2 text-xs">
            Edit
          </Link>
        </div>

        <p className="mt-4 rounded-lg border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-2.5 text-xs leading-relaxed text-ink-muted">
          Imported without a verdict from the publisher, so it stays hidden until you pick one.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Excerpt title="Narration" text={current.narration} length={current.narrationLength} />
          <Excerpt title="Explanation" text={current.explanation} length={current.explanationLength} />
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
              {b.label}
            </button>
          ))}
          <button type="button" onClick={() => void act("skip")} disabled={busy || queue.length < 2} className={clsx("neu-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50")}>
            <Key>s</Key>
            Keep hidden
          </button>
          <button
            type="button"
            onClick={() => void act("delete")}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
          >
            <Key>d</Key>
            Delete
          </button>
        </div>
      </article>

      {queue.length > 1 && (
        <p className="text-xs text-ink-faint">
          Next: <span className="text-ink-muted">{queue[1].title}</span>
        </p>
      )}
    </div>
  );
}

function Excerpt({ title, text, length }: { title: string; text: string; length: number }) {
  return (
    <div className="min-w-0">
      <h3 className="eyebrow">{title}</h3>
      {text ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
          {text}
          {length > EXCERPT_CHARS && <span className="text-ink-faint"> … ({length.toLocaleString("en-US")} characters in all)</span>}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">Empty.</p>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-current/40 px-1.5 font-mono text-[10px] opacity-80">{children}</kbd>;
}
