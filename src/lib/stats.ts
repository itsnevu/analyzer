import { listArticles, type ArticleListItem } from "./articles";
import type { Verdict } from "./detect";
import { getDb } from "./db";
import { getSearchesByMonth, type MonthCount } from "./searches";

/**
 * Numbers for the public statistics page and the "popular" lists. Every
 * query here is cached for ten minutes in module scope, so the public pages
 * stay cheap however often they are opened. Server-only.
 */

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = compute();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Forgets every cached number (tests, and after an import). */
export function clearStatsCache(): void {
  cache.clear();
}

type Row = Record<string, unknown>;

export const VERDICTS: Verdict[] = ["hoax", "misleading", "valid"];

/* -------------------------------------------------------------- archive */

export interface ArchiveOverview {
  total: number;
  byVerdict: Record<Verdict, number>;
  byLang: { id: number; en: number };
  /** entries that carry the fact-check's text; the rest only link to the original */
  withText: number;
  linkOnly: number;
  publishers: number;
  /** entries without a publication date, left out of the year chart */
  undated: number;
  /** YYYY-MM-DD of the oldest and newest dated entries */
  first: string;
  last: string;
}

export function archiveOverview(): ArchiveOverview {
  return cached("overview", () => {
    const r = getDb()
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(verdict = 'hoax'), 0) AS hoax,
                COALESCE(SUM(verdict = 'misleading'), 0) AS misleading,
                COALESCE(SUM(verdict = 'valid'), 0) AS valid,
                COALESCE(SUM(lang = 'id'), 0) AS id,
                COALESCE(SUM(lang = 'en'), 0) AS en,
                COALESCE(SUM(explanation != '' OR narration != ''), 0) AS withText,
                COUNT(DISTINCT CASE WHEN sourceSite != '' THEN sourceSite END) AS publishers,
                COALESCE(SUM(date = ''), 0) AS undated,
                COALESCE(MIN(CASE WHEN date != '' THEN date END), '') AS first,
                COALESCE(MAX(date), '') AS last
         FROM articles WHERE published = 1`,
      )
      .get() as Row;
    const n = (k: string) => Number(r[k] ?? 0);
    return {
      total: n("total"),
      byVerdict: { hoax: n("hoax"), misleading: n("misleading"), valid: n("valid") },
      byLang: { id: n("id"), en: n("en") },
      withText: n("withText"),
      linkOnly: n("total") - n("withText"),
      publishers: n("publishers"),
      undated: n("undated"),
      first: String(r.first ?? ""),
      last: String(r.last ?? ""),
    };
  });
}

export interface YearCounts {
  year: string;
  byVerdict: Record<Verdict, number>;
}

/** Published entries per publication year and verdict, every year from the first to the last present. */
export function archiveByYear(): YearCounts[] {
  return cached("byYear", () => {
    const rows = getDb()
      .prepare(
        `SELECT substr(date, 1, 4) AS year, verdict, COUNT(*) AS n FROM articles
         WHERE published = 1 AND date != '' GROUP BY year, verdict`,
      )
      .all() as unknown as { year: string; verdict: string; n: number }[];
    const years = rows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
    if (!years.length) return [];
    const out = new Map<string, YearCounts>();
    for (let y = Math.min(...years); y <= Math.max(...years); y++) {
      out.set(String(y), { year: String(y), byVerdict: { hoax: 0, misleading: 0, valid: 0 } });
    }
    for (const r of rows) {
      const bucket = out.get(r.year);
      if (bucket && (VERDICTS as string[]).includes(r.verdict)) bucket.byVerdict[r.verdict as Verdict] += Number(r.n);
    }
    return [...out.values()];
  });
}

export interface PublisherCounts {
  site: string;
  total: number;
  withText: number;
  linkOnly: number;
}

/** Published entries per publisher, largest first, split into entries with text and link-only ones. */
export function archiveByPublisher(): PublisherCounts[] {
  return cached("byPublisher", () => {
    const rows = getDb()
      .prepare(
        `SELECT sourceSite AS site, COUNT(*) AS total, COALESCE(SUM(explanation != '' OR narration != ''), 0) AS withText
         FROM articles WHERE published = 1 AND sourceSite != '' GROUP BY sourceSite ORDER BY total DESC, site`,
      )
      .all() as unknown as { site: string; total: number; withText: number }[];
    return rows.map((r) => ({ site: r.site, total: Number(r.total), withText: Number(r.withText), linkOnly: Number(r.total) - Number(r.withText) }));
  });
}

export async function newestEntries(limit = 5): Promise<ArticleListItem[]> {
  const hit = cache.get(`newest:${limit}`);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as ArticleListItem[];
  const { items } = await listArticles({ pageSize: limit, withText: true });
  cache.set(`newest:${limit}`, { at: Date.now(), value: items });
  return items;
}

/* ------------------------------------------------------------- detector */

export interface DetectorUsage {
  /** checks per month, counts only */
  months: MonthCount[];
  total: number;
  /** YYYY-MM of the first and last logged month */
  first: string;
  last: string;
}

/** How often the detector has been used: counts from the search log, never the texts. */
export function detectorUsage(): DetectorUsage {
  return cached("detector", () => {
    const months = getSearchesByMonth();
    return {
      months,
      total: months.reduce((s, m) => s + m.count, 0),
      first: months[0]?.month ?? "",
      last: months[months.length - 1]?.month ?? "",
    };
  });
}

/* -------------------------------------------------------------- popular */

export interface PopularItem extends ArticleListItem {
  /** article-page visits in the period; 0 for the fallback entries */
  visits: number;
}

export interface PopularResult {
  items: PopularItem[];
  /** False when too few entries were visited and the newest ones are shown instead. */
  popular: boolean;
  days: number;
}

const MIN_VISITED = 3;

function toItem(row: Row): PopularItem {
  return {
    slug: String(row.slug),
    title: String(row.title),
    lang: row.lang === "en" ? "en" : "id",
    category: String(row.category),
    verdict: row.verdict as Verdict,
    date: String(row.date),
    summary: String(row.summaryEn || row.summaryId || ""),
    image: String(row.image ?? ""),
    sourceSite: String(row.sourceSite ?? ""),
    published: true,
    visits: Number(row.visits),
  };
}

/**
 * The published articles whose pages were opened most in the last `days`
 * days, from the research log's visits (one per browser session; the path
 * is the page the session started on). Falls back to the newest entries
 * with text while fewer than three articles have any visits.
 */
export async function popularArticles(days = 30, limit = 5): Promise<PopularResult> {
  const key = `popular:${days}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as PopularResult;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT a.slug, a.title, a.lang, a.category, a.verdict, a.date, a.summaryId, a.summaryEn, a.image, a.sourceSite, COUNT(*) AS visits
       FROM usage_log u JOIN articles a ON a.slug = substr(u.path, 7)
       WHERE u.kind = 'visit' AND u.staff = 0 AND u.path LIKE '/blog/%' AND u.at >= ? AND a.published = 1
       GROUP BY a.id ORDER BY visits DESC, a.date DESC, a.id DESC LIMIT ?`,
    )
    .all(since, limit) as Row[];

  let result: PopularResult;
  if (rows.length >= MIN_VISITED) {
    result = { items: rows.map(toItem), popular: true, days };
  } else {
    const { items } = await listArticles({ pageSize: limit, withText: true });
    result = { items: items.map((a) => ({ ...a, visits: 0 })), popular: false, days };
  }
  cache.set(key, { at: Date.now(), value: result });
  return result;
}
