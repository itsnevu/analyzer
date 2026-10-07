"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArticleFilter } from "@/lib/articles";
import { filterQuery } from "@/lib/admin-article-query";

export { filterQuery };
import { clsx } from "@/lib/clsx";
import { formatCount, sourceName } from "@/lib/sources";

/**
 * The admin article list's filter bar. A plain GET form, so it works without
 * JavaScript; with it, a changed select applies at once and the page is
 * navigated client-side instead of reloaded.
 */

export interface FilterOptions {
  sources: { site: string; count: number }[];
  years: string[];
  pageSizes: readonly number[];
}

const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

const SORTS: { value: string; label: string }[] = [
  { value: "", label: "Sort: default (relevance when searching, else newest)" },
  { value: "date:desc", label: "Date, newest first" },
  { value: "date:asc", label: "Date, oldest first" },
  { value: "updated:desc", label: "Recently updated" },
  { value: "updated:asc", label: "Least recently updated" },
  { value: "created:desc", label: "Recently created" },
  { value: "created:asc", label: "First created" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "title:desc", label: "Title Z–A" },
];

export function ArticlesFilters({ filter, options }: { filter: ArticleFilter; options: FilterOptions }) {
  const router = useRouter();
  const sortValue = filter.sort ? `${filter.sort}:${filter.order ?? (filter.sort === "title" ? "asc" : "desc")}` : "";
  const active = !!(filter.q || filter.verdict || filter.lang || filter.source || filter.year || filter.withText || filter.linkOnly || filter.sort || (filter.pageSize && filter.pageSize !== 25));

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const [sort, order] = get("sort").split(":");
    const query = filterQuery(
      { visibility: filter.visibility },
      {
        q: get("q"),
        verdict: get("verdict"),
        lang: get("lang"),
        source: get("source"),
        year: get("year"),
        text: get("text"),
        sort,
        order: sort ? order : "",
        pageSize: get("pageSize"),
      },
    );
    router.push(query ? `/admin/articles?${query}` : "/admin/articles");
  }

  const applyNow = (e: React.ChangeEvent<HTMLSelectElement>) => submit(e.currentTarget.form!);

  return (
    <form
      action="/admin/articles"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="neu flex flex-wrap items-center gap-2 p-3 text-sm"
      role="search"
      aria-label="Filter articles"
    >
      {filter.visibility && filter.visibility !== "all" && <input type="hidden" name="visibility" value={filter.visibility} />}
      <input type="search" name="q" defaultValue={filter.q ?? ""} placeholder="Search title or text…" className={clsx(field, "min-w-56 flex-1")} aria-label="Search" />
      <select name="verdict" defaultValue={filter.verdict ?? ""} onChange={applyNow} className={field} aria-label="Verdict">
        <option value="">Any verdict</option>
        <option value="hoax">Hoax</option>
        <option value="misleading">Misleading</option>
        <option value="valid">Credible</option>
      </select>
      <select name="lang" defaultValue={filter.lang ?? ""} onChange={applyNow} className={field} aria-label="Language">
        <option value="">Any language</option>
        <option value="id">Indonesian</option>
        <option value="en">English</option>
      </select>
      <select name="source" defaultValue={filter.source ?? ""} onChange={applyNow} className={clsx(field, "max-w-64")} aria-label="Source site">
        <option value="">All sources</option>
        {options.sources.map((s) => (
          <option key={s.site} value={s.site}>
            {sourceName(s.site)} ({formatCount(s.count)})
          </option>
        ))}
      </select>
      <select name="year" defaultValue={filter.year ?? ""} onChange={applyNow} className={field} aria-label="Year">
        <option value="">Any year</option>
        {options.years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select name="text" defaultValue={filter.withText ? "with" : filter.linkOnly ? "link" : ""} onChange={applyNow} className={field} aria-label="Text">
        <option value="">Text or link-only</option>
        <option value="with">With text</option>
        <option value="link">Link-only</option>
      </select>
      <select name="sort" defaultValue={sortValue} onChange={applyNow} className={field} aria-label="Sort order">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <select name="pageSize" defaultValue={String(filter.pageSize ?? 25)} onChange={applyNow} className={field} aria-label="Rows per page">
        {options.pageSizes.map((n) => (
          <option key={n} value={n}>{n} per page</option>
        ))}
      </select>
      <button type="submit" className="neu-btn px-4 py-2">Apply</button>
      {active && (
        <Link href={filter.visibility && filter.visibility !== "all" ? `/admin/articles?visibility=${filter.visibility}` : "/admin/articles"} className="px-2 text-xs text-ink-muted hover:text-ink">
          Reset
        </Link>
      )}
    </form>
  );
}
