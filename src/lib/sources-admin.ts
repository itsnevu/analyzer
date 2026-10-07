import { panelDb } from "./legacy-panel";
import { isGone } from "./sources";

/**
 * The source sites the old crawler collected from (/admin/sources): the
 * legacy_sources table with counts from the dataset and the archive, plus the
 * crawler's listing pages (crawl_queue), read-only. Server-only.
 */

export interface SourceAdmin {
  id: number;
  site: string;
  url: string;
  lang: string;
  description: string;
  htmlPage: string;
  header: boolean;
  stemming: boolean;
  socialMedia: string;
  active: boolean;
  origin: "legacy" | "site";
  /** dataset rows with an effective label */
  labeled: number;
  unlabeled: number;
  /** archive entries whose sourceSite is this site */
  articles: number;
  /** the site's old links no longer work (see isGone) */
  offline: boolean;
}

export interface SourceInput {
  url: string;
  lang: string;
  description: string;
  htmlPage: string;
  header: boolean;
  stemming: boolean;
  socialMedia: string;
  active: boolean;
}

export interface CrawlQueueRow {
  id: number;
  sourceId: number | null;
  url: string;
  page: number;
  lastPage: number;
  suffix: string;
  status: string;
}

/** Columns the grid can sort by; without one the list goes by total rows, largest first. */
export const SOURCE_SORTS = ["site", "lang", "labeled", "unlabeled", "articles"] as const;
export type SourceSort = (typeof SOURCE_SORTS)[number];

export function isSourceSort(v: unknown): v is SourceSort {
  return typeof v === "string" && (SOURCE_SORTS as readonly string[]).includes(v);
}

export interface SourceFilter {
  /** substring of the site or its URL */
  q?: string;
  /** en | id | ms, or "none" for rows without a language */
  lang?: string;
  status?: "" | "active" | "inactive" | "offline";
  origin?: "" | "legacy" | "site";
  sort?: SourceSort;
  order?: "asc" | "desc";
}

const SELECT = `SELECT s.*,
    (SELECT COUNT(*) FROM legacy_dataset d WHERE d.sourceId = s.id AND COALESCE(d.adminLabel, d.label) IS NOT NULL) AS labeled,
    (SELECT COUNT(*) FROM legacy_dataset d WHERE d.sourceId = s.id AND COALESCE(d.adminLabel, d.label) IS NULL) AS unlabeled,
    (SELECT COUNT(*) FROM articles a WHERE a.sourceSite = s.site) AS articles
  FROM legacy_sources s`;

type Row = Record<string, unknown>;

function toSource(r: Row): SourceAdmin {
  const url = String(r.url ?? "");
  return {
    id: Number(r.id),
    site: String(r.site ?? ""),
    url,
    lang: String(r.lang ?? ""),
    description: String(r.description ?? ""),
    htmlPage: String(r.htmlPage ?? ""),
    header: Number(r.header) === 1,
    stemming: Number(r.stemming) === 1,
    socialMedia: String(r.socialMedia ?? ""),
    active: Number(r.active) !== 0,
    origin: r.origin === "site" ? "site" : "legacy",
    labeled: Number(r.labeled ?? 0),
    unlabeled: Number(r.unlabeled ?? 0),
    articles: Number(r.articles ?? 0),
    // isGone matches whole-site patterns against a URL with a path, so make sure there is one.
    offline: !!url && isGone(/^https?:\/\//i.test(url) ? (url.endsWith("/") ? url : `${url}/`) : `https://${url}/`),
  };
}

/** Hostname without "www." or "indeks.", as the import script stores it; "" for junk. */
export function siteOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^(www|indeks)\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const ORDER_BY: Record<SourceSort, string> = { site: "s.site", lang: "s.lang", labeled: "labeled", unlabeled: "unlabeled", articles: "articles" };

export function listSourcesAdmin(f: SourceFilter = {}): SourceAdmin[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.q?.trim()) {
    where.push("(s.site LIKE ? OR s.url LIKE ?)");
    args.push(`%${f.q.trim()}%`, `%${f.q.trim()}%`);
  }
  if (f.lang === "none") where.push("s.lang = ''");
  else if (f.lang) {
    where.push("s.lang = ?");
    args.push(f.lang);
  }
  if (f.status === "active") where.push("s.active != 0");
  if (f.status === "inactive") where.push("s.active = 0");
  if (f.origin === "site") where.push("s.origin = 'site'");
  if (f.origin === "legacy") where.push("s.origin != 'site'");
  const dir = f.order === "asc" ? "ASC" : f.order === "desc" ? "DESC" : f.sort === "site" || f.sort === "lang" ? "ASC" : "DESC";
  const order = f.sort ? `ORDER BY ${ORDER_BY[f.sort]} ${dir}, s.site` : "ORDER BY labeled + unlabeled + articles DESC, s.site";
  const rows = (panelDb().prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ${order}`).all(...args) as Row[]).map(toSource);
  // "offline" is worked out from the URL, not stored, so it is filtered here.
  return f.status === "offline" ? rows.filter((s) => s.offline) : rows;
}

/** Reads the grid's filter from query parameters. */
export function sourceFilterFrom(get: (key: string) => string | undefined): SourceFilter {
  const lang = get("lang");
  const status = get("status");
  const origin = get("origin");
  const sort = get("sort");
  const order = get("order");
  return {
    q: (get("q") ?? "").trim().slice(0, 100),
    lang: lang === "en" || lang === "id" || lang === "ms" || lang === "none" ? lang : "",
    status: status === "active" || status === "inactive" || status === "offline" ? status : "",
    origin: origin === "legacy" || origin === "site" ? origin : "",
    sort: isSourceSort(sort) ? sort : undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
  };
}

export function getSourceAdmin(id: number): SourceAdmin | null {
  const row = panelDb().prepare(`${SELECT} WHERE s.id = ?`).get(id) as Row | undefined;
  return row ? toSource(row) : null;
}

/** Turns a request body into a source, or null when the URL is not usable. */
export function normalizeSourceInput(body: Record<string, unknown>): SourceInput | null {
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const url = s(body.url, 300);
  if (!url || !siteOf(url).includes(".")) return null;
  const lang = s(body.lang, 2);
  return {
    url,
    lang: lang === "en" || lang === "id" || lang === "ms" ? lang : "",
    description: s(body.description, 1000),
    htmlPage: s(body.htmlPage, 200),
    header: body.header === true || body.header === 1 || body.header === "1" || body.header === "yes",
    stemming: body.stemming === true || body.stemming === 1 || body.stemming === "1" || body.stemming === "yes",
    socialMedia: s(body.socialMedia, 100),
    active: !(body.active === false || body.active === 0 || body.active === "0" || body.active === "no"),
  };
}

/** Adds a source (origin "site"), or updates one; the origin of an existing row never changes. */
export function saveSource(input: SourceInput, id?: number): number {
  const db = panelDb();
  const site = siteOf(input.url);
  const values = [site, input.url, input.lang, input.description, input.htmlPage, input.header ? 1 : 0, input.stemming ? 1 : 0, input.socialMedia, input.active ? 1 : 0];
  if (id) {
    const r = db
      .prepare(
        `UPDATE legacy_sources SET site = ?, url = ?, lang = ?, description = ?, htmlPage = ?, header = ?, stemming = ?, socialMedia = ?, active = ?
         WHERE id = ?`,
      )
      .run(...values, id);
    return Number(r.changes) ? id : 0;
  }
  const r = db
    .prepare(
      `INSERT INTO legacy_sources (site, url, lang, description, htmlPage, header, stemming, socialMedia, active, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'site')`,
    )
    .run(...values);
  return Number(r.lastInsertRowid);
}

/** Only rows added here can go; a legacy row is set inactive instead. */
export function deleteSource(id: number): "deleted" | "legacy" | "missing" {
  const db = panelDb();
  const row = db.prepare("SELECT origin FROM legacy_sources WHERE id = ?").get(id) as { origin: string } | undefined;
  if (!row) return "missing";
  if (row.origin !== "site") return "legacy";
  db.prepare("DELETE FROM legacy_sources WHERE id = ?").run(id);
  return "deleted";
}

/** The old crawler's listing pages, for one source or all of them. */
export function getCrawlQueue(sourceId?: number): CrawlQueueRow[] {
  const db = panelDb();
  const rows = (
    sourceId === undefined
      ? db.prepare("SELECT * FROM crawl_queue ORDER BY sourceId, id").all()
      : db.prepare("SELECT * FROM crawl_queue WHERE sourceId = ? ORDER BY id").all(sourceId)
  ) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    sourceId: r.sourceId == null ? null : Number(r.sourceId),
    url: String(r.url ?? ""),
    page: Number(r.page ?? 0),
    lastPage: Number(r.lastPage ?? 0),
    suffix: String(r.suffix ?? ""),
    status: String(r.status ?? ""),
  }));
}
