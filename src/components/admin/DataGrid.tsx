"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * The panel's data grid, in the spirit of the old control panel's jqGrid
 * tables: a caption bar, a filter row under the headers, zebra rows, optional
 * row selection, and a footer with the pager and "View a–b of N".
 *
 * State lives in the URL (the pages are server-rendered from searchParams):
 * typing in a filter rewrites the query string after a short pause, sorting and
 * paging are links. Columns are defined by the page's own client component,
 * since render functions cannot cross the server boundary.
 */

export type GridFilter =
  | { type: "text"; placeholder?: string }
  | { type: "select"; options: { value: string; label: string }[]; placeholder?: string };

export interface GridColumn<Row> {
  key: string;
  header: React.ReactNode;
  /** CSS width of the column, e.g. "160px" (applied as width and min-width); defaults to auto */
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  filter?: GridFilter;
  /** filter query parameter name when it differs from the column key */
  param?: string;
  render: (row: Row) => React.ReactNode;
  className?: string;
}

export interface GridPaging {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}

export interface DataGridProps<Row> {
  caption?: React.ReactNode;
  columns: GridColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  paging?: GridPaging;
  pageSizes?: number[];
  sort?: { key: string; order: "asc" | "desc" };
  /** parameter names used in the URL */
  params?: { sort?: string; order?: string; page?: string; pageSize?: string };
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** buttons shown above the table, left */
  toolbar?: React.ReactNode;
  /** buttons shown above the table, right */
  toolbarRight?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  dense?: boolean;
  /** called after the URL changed because of a filter, sort or page-size change */
  onNavigate?: () => void;
}

const DEFAULT_PARAMS = { sort: "sort", order: "order", page: "page", pageSize: "pageSize" };
const DEBOUNCE_MS = 350;

export function DataGrid<Row>({
  caption,
  columns,
  rows,
  rowKey,
  paging,
  pageSizes = [25, 50, 100],
  sort,
  params,
  selectable = false,
  selected,
  onSelectedChange,
  toolbar,
  toolbarRight,
  emptyMessage = "Nothing matches.",
  dense = false,
  onNavigate,
}: DataGridProps<Row>) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const names = { ...DEFAULT_PARAMS, ...params };
  const timer = useRef<number | null>(null);

  // Filter inputs are controlled locally so typing stays smooth; the URL follows after the pause.
  const filterColumns = columns.filter((c) => c.filter);
  const paramOf = (c: GridColumn<Row>) => c.param ?? c.key;
  const fromUrl: Record<string, string> = {};
  for (const c of filterColumns) fromUrl[c.key] = search.get(paramOf(c)) ?? "";
  // When the URL changes under us (back button, "clear filters"), the drafts follow it; done during render as React advises.
  const urlKey = JSON.stringify(fromUrl);
  const [seenKey, setSeenKey] = useState(urlKey);
  const [draft, setDraft] = useState<Record<string, string>>(fromUrl);
  if (seenKey !== urlKey) {
    setSeenKey(urlKey);
    setDraft(fromUrl);
  }

  function href(changes: Record<string, string | null>): string {
    const p = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  }

  function navigate(changes: Record<string, string | null>) {
    router.replace(href({ ...changes, [names.page]: null }));
    onNavigate?.();
  }

  function setFilter(column: GridColumn<Row>, value: string, immediate = false) {
    setDraft((d) => ({ ...d, [column.key]: value }));
    if (timer.current) window.clearTimeout(timer.current);
    const apply = () => navigate({ [paramOf(column)]: value });
    if (immediate) apply();
    else timer.current = window.setTimeout(apply, DEBOUNCE_MS);
  }

  const anyFilter = filterColumns.some((c) => (search.get(paramOf(c)) ?? "") !== "");
  const clearFilters = () => navigate(Object.fromEntries(filterColumns.map((c) => [paramOf(c), null])));

  const keys = rows.map(rowKey);
  const allSelected = selectable && keys.length > 0 && keys.every((k) => selected?.has(k));
  const someSelected = selectable && keys.some((k) => selected?.has(k));
  function toggleAll() {
    if (!onSelectedChange) return;
    const next = new Set(selected ?? []);
    if (allSelected) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onSelectedChange(next);
  }
  function toggleOne(key: string) {
    if (!onSelectedChange) return;
    const next = new Set(selected ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange(next);
  }

  const cell = clsx("px-3", dense ? "py-1.5" : "py-2.5");
  const alignCls = (a?: "left" | "right" | "center") => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const sortHref = (c: GridColumn<Row>) => {
    const order = sort?.key === c.key && sort.order === "asc" ? "desc" : "asc";
    return href({ [names.sort]: c.key, [names.order]: order, [names.page]: null });
  };

  const first = paging ? (paging.total === 0 ? 0 : (paging.page - 1) * paging.pageSize + 1) : 0;
  const last = paging ? Math.min(paging.total, paging.page * paging.pageSize) : 0;

  return (
    <div className="neu overflow-hidden p-0">
      {(caption || toolbar || toolbarRight || anyFilter) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-sunken/60 px-3 py-2">
          {caption && <div className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{caption}</div>}
          {toolbar}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {anyFilter && (
              <button type="button" onClick={clearFilters} className="neu-btn px-3 py-1.5 text-xs">
                Clear filters ×
              </button>
            )}
            <button type="button" onClick={() => router.refresh()} className="neu-btn px-3 py-1.5 text-xs" title="Reload the rows">
              ↻ Refresh
            </button>
            {toolbarRight}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-raised">
            <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {selectable && (
                <th scope="col" className={clsx(cell, "w-9")}>
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-brand"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" style={{ width: c.width, minWidth: c.width }} className={clsx(cell, alignCls(c.align), "whitespace-nowrap font-semibold")}>
                  {c.sortable ? (
                    <Link href={sortHref(c)} className="inline-flex items-center gap-1 hover:text-ink" aria-sort={sort?.key === c.key ? (sort.order === "asc" ? "ascending" : "descending") : undefined}>
                      {c.header}
                      <span aria-hidden className={clsx("text-[10px]", sort?.key === c.key ? "text-ink" : "text-ink-faint/60")}>
                        {sort?.key === c.key ? (sort.order === "asc" ? "▲" : "▼") : "◇"}
                      </span>
                    </Link>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
            {filterColumns.length > 0 && (
              <tr className="border-b border-hairline bg-surface-sunken/40">
                {selectable && <th className={cell} aria-hidden />}
                {columns.map((c) => (
                  <th key={`f-${c.key}`} className={clsx("px-2 py-1.5 font-normal", alignCls(c.align))}>
                    {c.filter?.type === "text" && (
                      <span className="relative block">
                        <input
                          type="search"
                          value={draft[c.key] ?? ""}
                          onChange={(e) => setFilter(c, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setFilter(c, (e.target as HTMLInputElement).value, true);
                          }}
                          placeholder={c.filter.placeholder ?? "Filter…"}
                          aria-label={`Filter by ${typeof c.header === "string" ? c.header : c.key}`}
                          className="h-8 w-full rounded-md border border-hairline bg-surface-raised px-2 text-xs text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30"
                        />
                      </span>
                    )}
                    {c.filter?.type === "select" && (
                      <select
                        value={draft[c.key] ?? ""}
                        onChange={(e) => setFilter(c, e.target.value, true)}
                        aria-label={`Filter by ${typeof c.header === "string" ? c.header : c.key}`}
                        className="h-8 w-full rounded-md border border-hairline bg-surface-raised px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30"
                      >
                        <option value="">{c.filter.placeholder ?? "All"}</option>
                        {c.filter.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-sm text-ink-faint">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const key = keys[i];
              const isSelected = selectable && selected?.has(key);
              return (
                <tr key={key} className={clsx("border-b border-hairline last:border-b-0", i % 2 === 1 && "bg-surface-sunken/35", isSelected && "bg-brand/10")}>
                  {selectable && (
                    <td className={cell}>
                      <input type="checkbox" aria-label="Select row" checked={!!isSelected} onChange={() => toggleOne(key)} className="h-4 w-4 accent-brand" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={clsx(cell, alignCls(c.align), "align-top", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paging && (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline bg-surface-sunken/60 px-3 py-2 text-xs text-ink-muted">
          <div className="flex items-center gap-1">
            <PagerLink href={href({ [names.page]: null })} disabled={paging.page <= 1} label="First page">«</PagerLink>
            <PagerLink href={href({ [names.page]: paging.page - 1 <= 1 ? null : String(paging.page - 1) })} disabled={paging.page <= 1} label="Previous page">‹</PagerLink>
            <span className="px-2 tabular-nums">
              Page <span className="font-semibold text-ink">{paging.page}</span> of {paging.pages.toLocaleString("en-US")}
            </span>
            <PagerLink href={href({ [names.page]: String(paging.page + 1) })} disabled={paging.page >= paging.pages} label="Next page">›</PagerLink>
            <PagerLink href={href({ [names.page]: String(paging.pages) })} disabled={paging.page >= paging.pages} label="Last page">»</PagerLink>
          </div>
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Rows per page</span>
            <select
              value={paging.pageSize}
              onChange={(e) => navigate({ [names.pageSize]: e.target.value })}
              className="h-7 rounded-md border border-hairline bg-surface-raised px-1.5 text-xs text-ink outline-none"
              aria-label="Rows per page"
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>per page</span>
          </label>
          {selectable && selected && selected.size > 0 && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">{selected.size} selected</span>}
          <span className="ml-auto tabular-nums">
            View {first.toLocaleString("en-US")}–{last.toLocaleString("en-US")} of {paging.total.toLocaleString("en-US")}
          </span>
        </div>
      )}
    </div>
  );
}

function PagerLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid h-7 w-7 place-items-center rounded-md border border-hairline text-sm";
  if (disabled) return <span className={clsx(cls, "text-ink-faint/50")} aria-disabled="true">{children}</span>;
  return (
    <Link href={href} aria-label={label} className={clsx(cls, "text-ink hover:bg-surface-raised")}>
      {children}
    </Link>
  );
}
