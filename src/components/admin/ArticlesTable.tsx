"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArticleListEntry } from "@/lib/articles";
import type { Verdict } from "@/lib/detect";
import { clsx } from "@/lib/clsx";
import { LANGUAGE_NAME, formatCount, formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";

type BulkAction = "publish" | "hide" | "delete" | "verdict";

const EMPTY: ReadonlySet<string> = new Set();

const field = "h-7 rounded-md border border-hairline bg-surface-raised px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill =
  "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

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
 * The admin article list on the panel grid: per-column filters, sortable
 * dates and title, a checkbox per row and bulk publish / hide / set verdict /
 * delete through POST /api/admin/articles/bulk.
 */
export function ArticlesTable({
  articles,
  sources,
  years,
  paging,
  sort,
  exportHref,
}: {
  articles: ArticleListEntry[];
  sources: { site: string; count: number }[];
  years: string[];
  paging: GridPaging;
  sort?: { key: string; order: "asc" | "desc" };
  exportHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkVerdict, setBulkVerdict] = useState<Verdict>("hoax");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // A selection belongs to the page of rows it was made on; a new page starts empty.
  const slugs = articles.map((a) => a.slug);
  const pageKey = slugs.join("|");
  const [selection, setSelection] = useState<{ key: string; slugs: ReadonlySet<string> }>({ key: pageKey, slugs: new Set() });
  const selected = selection.key === pageKey ? selection.slugs : EMPTY;
  const setSelected = (next: ReadonlySet<string>) => setSelection({ key: pageKey, slugs: next });
  const onPage = slugs.filter((s) => selected.has(s));

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

  const columns: GridColumn<ArticleListEntry>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: "Search title or text…" },
      className: "min-w-[280px]",
      render: (a) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/articles/${a.slug}/edit`}
              className="line-clamp-2 font-medium hover:text-brand focus-visible:underline focus-visible:outline-none"
              title={a.title}
            >
              {a.title}
            </Link>
            {!a.published && <Chip>hidden</Chip>}
            {!a.hasText && <Chip title="Title and verdict only; no text of its own">link-only</Chip>}
          </div>
          {a.category && <div className="truncate text-xs text-ink-faint">{a.category}</div>}
        </div>
      ),
    },
    {
      key: "verdict",
      header: "Verdict",
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "hoax", label: "Hoax" },
          { value: "misleading", label: "Misleading" },
          { value: "valid", label: "Credible" },
        ],
        placeholder: "Any",
      },
      render: (a) => (
        <span className="text-xs font-semibold" style={{ color: VERDICT_META[a.verdict].color }}>
          {VERDICT_META[a.verdict].labelEn}
        </span>
      ),
    },
    {
      key: "lang",
      header: "Language",
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "id", label: "Indonesian" },
          { value: "en", label: "English" },
        ],
        placeholder: "Any",
      },
      render: (a) => <span className="text-xs text-ink-muted">{LANGUAGE_NAME[a.lang] ?? a.lang}</span>,
    },
    {
      key: "source",
      header: "Source",
      width: "160px",
      filter: {
        type: "select",
        options: sources.map((s) => ({ value: s.site, label: `${sourceName(s.site)} (${formatCount(s.count)})` })),
        placeholder: "All sources",
      },
      render: (a) => (
        <span className="block max-w-[160px] truncate text-xs text-ink-muted" title={a.sourceSite || undefined}>
          {a.sourceSite ? sourceName(a.sourceSite) : "written here"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      width: "120px",
      sortable: true,
      param: "year",
      filter: { type: "select", options: years.map((y) => ({ value: y, label: y })), placeholder: "Any year" },
      render: (a) => <span className="whitespace-nowrap text-xs text-ink-muted">{formatDate(a.date) || "—"}</span>,
    },
    {
      key: "updated",
      header: "Updated",
      width: "115px",
      sortable: true,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-ink-muted" title={a.updatedAt ? `${a.updatedAt} UTC` : undefined}>
          {a.updatedAt ? stampDate(a.updatedAt) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      width: "115px",
      sortable: true,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-ink-faint" title={a.createdAt ? `${a.createdAt} UTC` : undefined}>
          {a.createdAt ? stampDate(a.createdAt) : "—"}
        </span>
      ),
    },
    {
      key: "text",
      header: "Text",
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "with", label: "With text" },
          { value: "link", label: "Link-only" },
        ],
        placeholder: "Either",
      },
      render: (a) => <span className="text-xs text-ink-muted">{a.hasText ? "Text" : "Link-only"}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "150px",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1.5">
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
      ),
    },
  ];

  const bulkBusy = busy === "bulk";
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" role="region" aria-label="Bulk actions">
      {onPage.length > 0 ? (
        <>
          <span className="mr-1 font-medium text-ink">{onPage.length} selected</span>
          <button type="button" onClick={() => bulk("publish")} disabled={bulkBusy} className={pill}>
            Publish
          </button>
          <button type="button" onClick={() => bulk("hide")} disabled={bulkBusy} className={pill}>
            Hide
          </button>
          <span className="inline-flex items-center gap-1">
            <select value={bulkVerdict} onChange={(e) => setBulkVerdict(e.target.value as Verdict)} className={field} aria-label="Verdict to set" disabled={bulkBusy}>
              <option value="hoax">Hoax</option>
              <option value="misleading">Misleading</option>
              <option value="valid">Credible</option>
            </select>
            <button type="button" onClick={() => bulk("verdict")} disabled={bulkBusy} className={pill}>
              Set verdict
            </button>
          </span>
          <button type="button" onClick={() => bulk("delete")} disabled={bulkBusy} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
            Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={bulkBusy} className="px-2 text-ink-muted hover:text-ink">
            Clear selection
          </button>
          {bulkBusy && <span className="text-ink-muted">Working…</span>}
        </>
      ) : (
        <span className="text-ink-faint">Select rows for bulk actions</span>
      )}
      {message && (
        <span role="status" className={clsx("ml-2", message.ok ? "text-verdict-valid" : "text-verdict-hoax")}>
          {message.text}
        </span>
      )}
    </div>
  );

  return (
    <DataGrid
      columns={columns}
      rows={articles}
      rowKey={(a) => a.slug}
      paging={paging}
      pageSizes={[25, 50, 100]}
      sort={sort}
      selectable
      selected={selected}
      onSelectedChange={setSelected}
      toolbar={toolbar}
      toolbarRight={
        <a href={exportHref} className="btn-primary px-3 py-1.5 text-xs">
          Export CSV ({formatCount(paging.total)})
        </a>
      }
      emptyMessage={
        <>
          No articles match.{" "}
          <Link href="/admin/articles/new" className="text-brand hover:underline">
            Add one →
          </Link>
        </>
      }
      dense
    />
  );
}
