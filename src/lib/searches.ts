import { panelDb } from "./legacy-panel";
import { csvCell } from "./csv";

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

/* ------------------------------------------------------------ admin list */

/** Columns the grid can sort by. */
export const SEARCH_SORTS = ["date", "query", "verdict", "origin"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function isSearchSort(v: unknown): v is SearchSort {
  return typeof v === "string" && (SEARCH_SORTS as readonly string[]).includes(v);
}

export interface SearchFilter {
  /** substring of the query text */
  q?: string;
  /** YYYY-MM-DD, inclusive, on the stored timestamp's date */
  from?: string;
  to?: string;
  origin?: "" | "site" | "legacy";
  verdict?: string;
  /** default: date, newest first */
  sort?: SearchSort;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface SearchPage {
  items: SearchRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

function searchWhere(f: SearchFilter): { sql: string; args: string[] } {
  const where: string[] = [];
  const args: string[] = [];
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
  if (f.q?.trim()) {
    where.push("query LIKE ?");
    args.push(`%${f.q.trim()}%`);
  }
  if (date(f.from)) {
    where.push("substr(createdAt, 1, 10) >= ?");
    args.push(date(f.from));
  }
  if (date(f.to)) {
    where.push("substr(createdAt, 1, 10) <= ?");
    args.push(date(f.to));
  }
  if (f.origin === "site" || f.origin === "legacy") {
    where.push("origin = ?");
    args.push(f.origin);
  }
  if (f.verdict === "none") where.push("verdict IS NULL");
  else if (f.verdict) {
    where.push("verdict = ?");
    args.push(f.verdict);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", args };
}

/** The order a filter asks for, defaults filled in: queries A–Z, everything else newest first. */
export function searchSortOf(f: SearchFilter): { key: SearchSort; order: "asc" | "desc" } {
  const key = f.sort ?? "date";
  return { key, order: f.order ?? (key === "query" ? "asc" : "desc") };
}

function searchOrder(f: SearchFilter): string {
  const { key, order } = searchSortOf(f);
  const dir = order === "asc" ? "ASC" : "DESC";
  if (key === "query") return `ORDER BY query COLLATE NOCASE ${dir}, id DESC`;
  if (key === "verdict") return `ORDER BY verdict IS NULL, verdict ${dir}, createdAt DESC, id DESC`;
  if (key === "origin") return `ORDER BY origin ${dir}, createdAt DESC, id DESC`;
  return `ORDER BY createdAt ${dir}, id ${dir}`;
}

/** The search log, newest first unless sorted otherwise, for the admin table. */
export function listSearches(f: SearchFilter = {}): SearchPage {
  const db = panelDb();
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 200);
  const { sql, args } = searchWhere(f);
  const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM searches ${sql}`).get(...args) as { n: number };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(f.page ?? 1) || 1, 1), pages);
  // node:sqlite rows have a null prototype, which React refuses to pass to client components; spread them.
  const items = (
    db
      .prepare(`SELECT id, query, verdict, origin, createdAt FROM searches ${sql} ${searchOrder(f)} LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize) as unknown as SearchRow[]
  ).map((r) => ({ ...r }));
  return { items, total, page, pages, pageSize };
}

export function deleteSearch(id: number): boolean {
  return Number(panelDb().prepare("DELETE FROM searches WHERE id = ?").run(id).changes) > 0;
}

/** The filtered log as CSV, oldest first. */
export function* searchesCsv(f: SearchFilter): Generator<string> {
  const cols = ["id", "createdAt", "origin", "verdict", "query"];
  const cell = csvCell;
  yield "\ufeff" + cols.join(",") + "\n";
  const { sql, args } = searchWhere(f);
  const rows = panelDb().prepare(`SELECT id, createdAt, origin, verdict, query FROM searches ${sql} ORDER BY createdAt, id`).iterate(...args) as Iterable<Record<string, unknown>>;
  for (const row of rows) yield cols.map((c) => cell(row[c])).join(",") + "\n";
}

/** Reads the filter from query parameters (page, API and export share it); `sort`/`order` come back with their defaults filled in. */
export function searchFilterFrom(get: (key: string) => string | undefined): SearchFilter {
  const origin = get("origin");
  const verdict = get("verdict") ?? "";
  const sort = get("sort");
  const order = get("order");
  const f: SearchFilter = {
    q: (get("q") ?? "").trim().slice(0, 200),
    from: get("from"),
    to: get("to"),
    origin: origin === "site" || origin === "legacy" ? origin : "",
    verdict: ["hoax", "misleading", "valid", "none"].includes(verdict) ? verdict : "",
    sort: isSearchSort(sort) ? sort : "date",
    order: order === "asc" || order === "desc" ? order : undefined,
    page: Number(get("page")) || 1,
    pageSize: Number(get("pageSize")) || undefined,
  };
  return { ...f, ...searchSortOf(f) };
}
