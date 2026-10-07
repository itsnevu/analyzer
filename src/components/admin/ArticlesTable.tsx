"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ArticleListEntry } from "@/lib/articles";
import type { Verdict } from "@/lib/detect";
import { clsx } from "@/lib/clsx";
import { LANGUAGE_NAME, formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";

type BulkAction = "publish" | "hide" | "delete" | "verdict";

const EMPTY: ReadonlySet<string> = new Set();

const field = "rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill = "rounded-full border border-hairline px-3 py-1.5 text-xs font-medium transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";
const check = "h-4 w-4 cursor-pointer rounded border-hairline accent-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/** "2026-10-07 13:45:12" (SQLite, UTC) → "Oct 7, 2026". */
function stampDate(stamp: string): string {
  return formatDate(stamp.slice(0, 10)) || "—";
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
      {children}
    </span>
  );
}

/**
 * The admin article list with a checkbox per row, "select all on this page"
 * and bulk publish / hide / set verdict / delete through POST /api/admin/articles/bulk.
 */
export function ArticlesTable({ articles }: { articles: ArticleListEntry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkVerdict, setBulkVerdict] = useState<Verdict>("hoax");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const allRef = useRef<HTMLInputElement>(null);

  // A selection belongs to the page of rows it was made on; a new page starts empty.
  const slugs = articles.map((a) => a.slug);
  const pageKey = slugs.join("|");
  const [selection, setSelection] = useState<{ key: string; slugs: ReadonlySet<string> }>({ key: pageKey, slugs: new Set() });
  const selected = selection.key === pageKey ? selection.slugs : EMPTY;
  const setSelected = (update: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) =>
    setSelection((prev) => {
      const base = prev.key === pageKey ? prev.slugs : EMPTY;
      return { key: pageKey, slugs: typeof update === "function" ? update(base) : update };
    });

  const onPage = slugs.filter((s) => selected.has(s));
  const allOnPage = articles.length > 0 && onPage.length === articles.length;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = onPage.length > 0 && !allOnPage;
  }, [onPage.length, allOnPage]);

  const toggle = (slug: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(slugs) : new Set());

  async function remove(slug: string, title: string) {
    if (!confirm(`Delete article "${title}"? This cannot be undone.`)) return;
    setBusy(slug);
    try {
      const res = await fetch(`/api/admin/articles/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  async function bulk(action: BulkAction) {
    const chosen = onPage;
    if (!chosen.length || busy) return;
    const n = chosen.length;
    const what =
      action === "delete"
        ? `Delete ${n} article${n === 1 ? "" : "s"}? This cannot be undone.`
        : action === "verdict"
          ? `Set the verdict of ${n} article${n === 1 ? "" : "s"} to "${VERDICT_META[bulkVerdict].labelEn}"?`
          : action === "hide"
            ? `Hide ${n} article${n === 1 ? "" : "s"} from the public site?`
            : `Publish ${n} article${n === 1 ? "" : "s"}?`;
    if (!confirm(what)) return;
    setBusy("bulk");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: chosen, action, verdict: action === "verdict" ? bulkVerdict : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { changed?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const verb = action === "delete" ? "Deleted" : action === "hide" ? "Hid" : action === "publish" ? "Published" : `Set the verdict of`;
      setMessage({ ok: true, text: `${verb} ${data.changed ?? 0} article${data.changed === 1 ? "" : "s"}.` });
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "The action failed." });
    } finally {
      setBusy(null);
    }
  }

  if (articles.length === 0) {
    return (
      <div className="neu p-10 text-center text-sm text-ink-muted">
        No articles match. <Link href="/admin/articles/new" className="text-brand hover:underline">Add one →</Link>
      </div>
    );
  }

  const grid = "md:grid-cols-[24px_1fr_96px_96px_96px_118px]";
  const bulkBusy = busy === "bulk";
  return (
    <div className="space-y-3">
      {(onPage.length > 0 || message) && (
        <div className="neu flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
          {onPage.length > 0 && (
            <>
              <span className="font-medium">
                {onPage.length} selected
              </span>
              <button type="button" onClick={() => bulk("publish")} disabled={bulkBusy} className={pill}>Publish</button>
              <button type="button" onClick={() => bulk("hide")} disabled={bulkBusy} className={pill}>Hide</button>
              <span className="inline-flex items-center gap-1">
                <select value={bulkVerdict} onChange={(e) => setBulkVerdict(e.target.value as Verdict)} className={field} aria-label="Verdict to set" disabled={bulkBusy}>
                  <option value="hoax">Hoax</option>
                  <option value="misleading">Misleading</option>
                  <option value="valid">Credible</option>
                </select>
                <button type="button" onClick={() => bulk("verdict")} disabled={bulkBusy} className={pill}>Set verdict</button>
              </span>
              <button type="button" onClick={() => bulk("delete")} disabled={bulkBusy} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
                Delete
              </button>
              <button type="button" onClick={() => toggleAll(false)} disabled={bulkBusy} className="px-2 text-xs text-ink-muted hover:text-ink">
                Clear selection
              </button>
              {bulkBusy && <span className="text-xs text-ink-muted">Working…</span>}
            </>
          )}
          {message && (
            <span role="status" className={clsx("ml-auto text-xs", message.ok ? "text-verdict-valid" : "text-verdict-hoax")}>
              {message.text}
            </span>
          )}
        </div>
      )}

      <div className="neu overflow-hidden p-0">
        <div className={clsx("hidden items-center gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid", grid)}>
          <input ref={allRef} type="checkbox" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all articles on this page" className={check} />
          <span>Title</span>
          <span>Verdict</span>
          <span>Date</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="divide-y divide-hairline">
          {articles.map((a) => {
            const m = VERDICT_META[a.verdict];
            const checked = selected.has(a.slug);
            return (
              <li key={a.slug} className={clsx("grid grid-cols-[24px_1fr] gap-x-3 gap-y-1 px-5 py-3.5 md:items-center md:gap-3", grid, checked && "bg-surface-sunken/60")}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(a.slug, e.target.checked)}
                  aria-label={`Select "${a.title}"`}
                  className={clsx(check, "mt-1 md:mt-0")}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/articles/${a.slug}/edit`} className="truncate font-medium hover:text-brand focus-visible:outline-none focus-visible:underline" title={a.title}>
                      {a.title}
                    </Link>
                    {!a.published && <Chip>hidden</Chip>}
                    {!a.hasText && <Chip title="Title and verdict only; no text of its own">link-only</Chip>}
                  </div>
                  <div className="truncate text-xs text-ink-faint">
                    {[LANGUAGE_NAME[a.lang], a.category, a.sourceSite ? sourceName(a.sourceSite) : "written here"].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="col-start-2 text-xs font-semibold md:col-start-auto" style={{ color: m.color }}>{m.labelEn}</span>
                <span className="col-start-2 text-xs text-ink-muted md:col-start-auto">{formatDate(a.date) || "—"}</span>
                <span className="col-start-2 text-xs text-ink-muted md:col-start-auto" title={a.updatedAt ? `${a.updatedAt} UTC` : undefined}>
                  {a.updatedAt ? stampDate(a.updatedAt) : "—"}
                </span>
                <div className="col-start-2 flex gap-2 md:col-start-auto md:justify-end">
                  <Link href={`/admin/articles/${a.slug}/edit`} className={pill}>
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(a.slug, a.title)}
                    disabled={busy === a.slug}
                    className={clsx(pill, "text-verdict-hoax hover:border-hairline hover:bg-verdict-hoax/10")}
                  >
                    {busy === a.slug ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
