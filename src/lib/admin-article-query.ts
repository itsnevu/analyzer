import type { ArticleFilter } from "./articles";

/**
 * The admin article list's filter as a query string, shared by the server page,
 * the filter bar and the CSV export link. Safe for client and server code.
 */

/** The filter as query parameters, without defaults; `changes` overrides single keys. */
export function filterQuery(f: ArticleFilter, changes: Record<string, string | number | undefined> = {}): string {
  const base: Record<string, string | number | undefined> = {
    q: f.q,
    verdict: f.verdict,
    lang: f.lang,
    source: f.source,
    year: f.year,
    text: f.withText ? "with" : f.linkOnly ? "link" : undefined,
    visibility: f.visibility && f.visibility !== "all" ? f.visibility : undefined,
    sort: f.sort,
    order: f.sort ? f.order : undefined,
    pageSize: f.pageSize && f.pageSize !== 25 ? f.pageSize : undefined,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...changes })) {
    if (v === undefined || v === "" || (k === "visibility" && v === "all") || (k === "pageSize" && Number(v) === 25) || (k === "page" && Number(v) <= 1)) continue;
    p.set(k, String(v));
  }
  return p.toString();
}
