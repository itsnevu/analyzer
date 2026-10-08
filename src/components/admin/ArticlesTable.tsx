"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArticleListEntry } from "@/lib/articles";
import type { Verdict } from "@/lib/detect";
import { clsx } from "@/lib/clsx";
import { adminLocale, formatAdminNumber, type AdminLang } from "@/lib/admin-lang";
import { LANGUAGE_NAME, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";
import { useAdminT } from "@/components/admin/AdminLang";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";
import { useToast } from "@/components/admin/Toast";

type BulkAction = "publish" | "hide" | "delete" | "verdict";

const EMPTY: ReadonlySet<string> = new Set();

const field = "h-8 rounded-md border border-hairline bg-surface-raised px-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill =
  "whitespace-nowrap rounded-full border border-hairline px-3 py-1.5 text-sm font-medium transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/** "2019-04-06" → "Apr 6, 2019" / "6 Apr 2019"; "" or junk → "—". */
function dayLabel(date: string, lang: AdminLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
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
  const { t, lang } = useAdminT();
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkVerdict, setBulkVerdict] = useState<Verdict>("hoax");
  const toast = useToast();

  // A selection belongs to the page of rows it was made on; a new page starts empty.
  const slugs = articles.map((a) => a.slug);
  const pageKey = slugs.join("|");
  const [selection, setSelection] = useState<{ key: string; slugs: ReadonlySet<string> }>({ key: pageKey, slugs: new Set() });
  const selected = selection.key === pageKey ? selection.slugs : EMPTY;
  const setSelected = (next: ReadonlySet<string>) => setSelection({ key: pageKey, slugs: next });
  const onPage = slugs.filter((s) => selected.has(s));

  async function remove(slug: string, title: string) {
    if (!confirm(t("Delete the article “{title}”? This cannot be undone.", { title }))) return;
    setBusy(slug);
    try {
      const res = await fetch(`/api/admin/articles/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ tone: "success", text: t("Deleted “{title}”.", { title }) });
      router.refresh();
    } catch {
      toast({ tone: "error", text: t("Could not delete the article.") });
    } finally {
      setBusy(null);
    }
  }

  function question(action: BulkAction, n: number): string {
    const verdict = t(VERDICT_META[bulkVerdict].label);
    if (action === "delete") return n === 1 ? t("Delete 1 article? This cannot be undone.") : t("Delete {n} articles? This cannot be undone.", { n });
    if (action === "verdict") return n === 1 ? t("Change the verdict of 1 article to “{verdict}”?", { verdict }) : t("Change the verdict of {n} articles to “{verdict}”?", { n, verdict });
    if (action === "hide") return n === 1 ? t("Hide 1 article from the site?") : t("Hide {n} articles from the site?", { n });
    return n === 1 ? t("Publish 1 article on the site?") : t("Publish {n} articles on the site?", { n });
  }

  function doneText(action: BulkAction, n: number): string {
    if (action === "delete") return n === 1 ? t("1 article deleted.") : t("{n} articles deleted.", { n });
    if (action === "hide") return n === 1 ? t("1 article hidden.") : t("{n} articles hidden.", { n });
    if (action === "publish") return n === 1 ? t("1 article published.") : t("{n} articles published.", { n });
    return n === 1 ? t("Verdict changed for 1 article.") : t("Verdict changed for {n} articles.", { n });
  }

  async function bulk(action: BulkAction) {
    const chosen = onPage;
    if (!chosen.length || busy) return;
    if (!confirm(question(action, chosen.length))) return;
    setBusy("bulk");
    try {
      const res = await fetch("/api/admin/articles/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: chosen, action, verdict: action === "verdict" ? bulkVerdict : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { changed?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? t("The action did not work."));
      toast({ tone: "success", text: doneText(action, data.changed ?? 0) });
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast({ tone: "error", text: err instanceof Error && err.message ? err.message : t("The action did not work.") });
    } finally {
      setBusy(null);
    }
  }

  const verdictOptions = (["hoax", "misleading", "valid"] as const).map((v) => ({ value: v, label: t(VERDICT_META[v].label) }));

  const columns: GridColumn<ArticleListEntry>[] = [
    {
      key: "title",
      header: t("Title"),
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: t("Search title or text…") },
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
            {!a.published && <Chip>{t("Hidden")}</Chip>}
            {!a.hasText && <Chip title={t("Only a title and a verdict; no text of its own")}>{t("Link only")}</Chip>}
          </div>
          {a.category && <div className="truncate text-xs text-ink-faint">{a.category}</div>}
        </div>
      ),
    },
    {
      key: "verdict",
      header: t("Verdict"),
      width: "120px",
      filter: { type: "select", options: verdictOptions, placeholder: t("Any") },
      render: (a) => (
        <span className="text-sm font-semibold" style={{ color: VERDICT_META[a.verdict].color }}>
          {t(VERDICT_META[a.verdict].label)}
        </span>
      ),
    },
    {
      key: "lang",
      header: t("Language"),
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "id", label: t("Indonesian") },
          { value: "en", label: t("English") },
        ],
        placeholder: t("Any"),
      },
      render: (a) => <span className="text-sm text-ink-muted">{LANGUAGE_NAME[a.lang] ? t(LANGUAGE_NAME[a.lang]) : a.lang}</span>,
    },
    {
      key: "source",
      header: t("Source"),
      width: "160px",
      filter: {
        type: "select",
        options: sources.map((s) => ({ value: s.site, label: `${sourceName(s.site)} (${formatAdminNumber(s.count, lang)})` })),
        placeholder: t("All sources"),
      },
      render: (a) => (
        <span className="block max-w-[160px] truncate text-sm text-ink-muted" title={a.sourceSite || undefined}>
          {a.sourceSite ? sourceName(a.sourceSite) : t("Written here")}
        </span>
      ),
    },
    {
      key: "date",
      header: t("Date"),
      width: "125px",
      sortable: true,
      param: "year",
      filter: { type: "select", options: years.map((y) => ({ value: y, label: y })), placeholder: t("Any year") },
      render: (a) => <span className="whitespace-nowrap text-sm text-ink-muted">{dayLabel(a.date, lang)}</span>,
    },
    {
      key: "updated",
      header: t("Last changed"),
      width: "125px",
      sortable: true,
      render: (a) => (
        <span className="whitespace-nowrap text-sm text-ink-muted" title={a.updatedAt ? `${a.updatedAt} UTC` : undefined}>
          {a.updatedAt ? dayLabel(a.updatedAt.slice(0, 10), lang) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: t("Added"),
      width: "125px",
      sortable: true,
      render: (a) => (
        <span className="whitespace-nowrap text-sm text-ink-faint" title={a.createdAt ? `${a.createdAt} UTC` : undefined}>
          {a.createdAt ? dayLabel(a.createdAt.slice(0, 10), lang) : "—"}
        </span>
      ),
    },
    {
      key: "text",
      header: t("Text"),
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "with", label: t("With text") },
          { value: "link", label: t("Link only") },
        ],
        placeholder: t("Any"),
      },
      render: (a) => <span className="text-sm text-ink-muted">{a.hasText ? t("Text") : t("Link only")}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("Actions")}</span>,
      width: "170px",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/admin/articles/${a.slug}/edit`} className={pill}>
            {t("Edit")}
          </Link>
          <button
            type="button"
            onClick={() => remove(a.slug, a.title)}
            disabled={busy === a.slug}
            className={clsx(pill, "text-verdict-hoax hover:border-hairline hover:bg-verdict-hoax/10")}
          >
            {busy === a.slug ? "…" : t("Delete")}
          </button>
        </div>
      ),
    },
  ];

  const bulkBusy = busy === "bulk";
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5 text-sm" role="region" aria-label={t("Actions for the ticked rows")}>
      {onPage.length > 0 ? (
        <>
          <span className="mr-1 font-medium text-ink">{t("{n} ticked", { n: onPage.length })}</span>
          <button type="button" onClick={() => bulk("publish")} disabled={bulkBusy} className={pill}>
            {t("Publish")}
          </button>
          <button type="button" onClick={() => bulk("hide")} disabled={bulkBusy} className={pill}>
            {t("Hide")}
          </button>
          <span className="inline-flex items-center gap-1">
            <select value={bulkVerdict} onChange={(e) => setBulkVerdict(e.target.value as Verdict)} className={field} aria-label={t("New verdict")} disabled={bulkBusy}>
              {verdictOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => bulk("verdict")} disabled={bulkBusy} className={pill}>
              {t("Change verdict")}
            </button>
          </span>
          <button type="button" onClick={() => bulk("delete")} disabled={bulkBusy} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
            {t("Delete")}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={bulkBusy} className="px-2 py-1.5 text-ink-muted hover:text-ink">
            {t("Untick all")}
          </button>
          {bulkBusy && <span className="text-ink-muted">{t("Working…")}</span>}
        </>
      ) : (
        <span className="text-ink-faint">{t("Tick rows to change several articles at once.")}</span>
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
        <a href={exportHref} className="btn-primary px-3 py-1.5 text-sm">
          {t("Export CSV ({n})", { n: paging.total })}
        </a>
      }
      emptyMessage={
        <>
          {t("No articles found.")}{" "}
          <Link href="/admin/articles/new" className="text-brand hover:underline">
            {t("Add one →")}
          </Link>
        </>
      }
      dense
    />
  );
}
