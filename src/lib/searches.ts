import { panelDb } from "./legacy-panel";

/**
 * Log of text submitted to the detector. Holds the legacy panel's search log
 * (origin "legacy", copied by `npm run import:panel`) and, once the detect API
 * calls recordSearch, searches made on this site. No IP addresses are kept.
 * Server-only.
 */

const MAX_QUERY = 2000;

export function recordSearch(query: string, verdict: string | null = null): void {
  const text = query.trim().slice(0, MAX_QUERY);
  if (!text) return;
  panelDb().prepare("INSERT INTO searches (query, verdict, origin) VALUES (?, ?, 'site')").run(text, verdict);
}

export interface SearchOverview {
  total: number;
  distinct: number;
  /** queries that were a pasted link rather than text */
  links: number;
  fromSite: number;
  first: string | null;
  last: string | null;
}

export function getSearchOverview(): SearchOverview {
  const r = panelDb()
    .prepare(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT lower(trim(query))) AS uniq,
              SUM(query LIKE 'http%') AS links, SUM(origin = 'site') AS fromSite,
              MIN(createdAt) AS first, MAX(createdAt) AS last
       FROM searches`,
    )
    .get() as Record<string, number | string | null>;
  return {
    total: Number(r.total),
    distinct: Number(r.uniq),
    links: Number(r.links ?? 0),
    fromSite: Number(r.fromSite ?? 0),
    first: (r.first as string | null) ?? null,
    last: (r.last as string | null) ?? null,
  };
}

export interface MonthCount {
  /** YYYY-MM */
  month: string;
  count: number;
  links: number;
}

/** Searches per month from the first logged month to the last, empty months included. */
export function getSearchesByMonth(): MonthCount[] {
  const rows = panelDb()
    .prepare(
      `SELECT substr(createdAt, 1, 7) AS month, COUNT(*) AS count, SUM(query LIKE 'http%') AS links
       FROM searches GROUP BY month ORDER BY month`,
    )
    .all() as unknown as MonthCount[];
  if (!rows.length) return [];

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: MonthCount[] = [];
  let [y, m] = rows[0].month.split("-").map(Number);
  const last = rows[rows.length - 1].month;
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const r = byMonth.get(key);
    out.push({ month: key, count: Number(r?.count ?? 0), links: Number(r?.links ?? 0) });
    if (key >= last) break;
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

export interface SearchRow {
  id: number;
  query: string;
  verdict: string | null;
  origin: "site" | "legacy";
  createdAt: string;
}

export function getRecentSearches(limit = 8): SearchRow[] {
  return panelDb()
    .prepare("SELECT id, query, verdict, origin, createdAt FROM searches ORDER BY createdAt DESC, id DESC LIMIT ?")
    .all(limit) as unknown as SearchRow[];
}

/** Queries submitted more than once, most repeated first. */
export function getRepeatedSearches(limit = 5): { query: string; count: number }[] {
  return panelDb()
    .prepare(
      `SELECT MIN(trim(query)) AS query, COUNT(*) AS count FROM searches
       GROUP BY lower(trim(query)) HAVING count > 1 ORDER BY count DESC, MAX(createdAt) DESC LIMIT ?`,
    )
    .all(limit) as unknown as { query: string; count: number }[];
}
