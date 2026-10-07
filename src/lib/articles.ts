import type { DatabaseSync } from "node:sqlite";
import { ARTICLES as SEED, type Article, type ArticleListItem } from "./data";
import { getDb, hasFts } from "./db";
export { slugify } from "./slug";
export type { ArticleListItem } from "./data";

/**
 * SQLite-backed article store (see ./db). An empty table is seeded with the
 * built-in ARTICLES examples; the real archive comes from `npm run import:legacy`. Server-only — never import this into a client
 * component; the public site reaches it through server components.
 *
 * The archive holds thousands of rows, so nothing here loads the whole table:
 * lists are paginated and return only what a card needs.
 */

/** Columns an editor can change. */
const COLUMNS = [
  "slug",
  "title",
  "lang",
  "category",
  "verdict",
  "date",
  "summaryId",
  "summaryEn",
  "source",
  "narration",
  "explanation",
  "reference",
  "image",
  "originalUrl",
  "sourceSite",
] as const satisfies readonly (keyof Article)[];

const COLUMN_LIST = COLUMNS.map((c) => `"${c}"`).join(", ");
const INSERT_SQL = `INSERT INTO articles (${COLUMN_LIST}, published) VALUES (${COLUMNS.map(() => "?").join(", ")}, ?)`;
const SELECT_SQL = `SELECT ${COLUMN_LIST}, published, archiveUrl FROM articles`;
const CARD_COLUMNS =
  "a.slug, a.title, a.lang, a.category, a.verdict, a.date, a.summaryId, a.summaryEn, a.image, a.sourceSite, a.published, " +
  "a.createdAt, a.updatedAt, (a.explanation != '' OR a.narration != '') AS hasText";

const globalForSeed = globalThis as unknown as { __hoaxSeeded?: boolean };

type Row = Record<string, unknown>;

export const ARTICLE_SORTS = ["date", "updated", "title", "created"] as const;
export type ArticleSort = (typeof ARTICLE_SORTS)[number];
export type SortOrder = "asc" | "desc";

export function isArticleSort(v: unknown): v is ArticleSort {
  return (ARTICLE_SORTS as readonly unknown[]).includes(v);
}

export interface ArticleFilter {
  q?: string;
  lang?: Article["lang"];
  verdict?: Article["verdict"];
  source?: string;
  year?: string;
  /** Only entries with text of their own, leaving out link-only ones. */
  withText?: boolean;
  /** Only link-only entries (title and verdict, no text of their own); ignored when `withText` is set. */
  linkOnly?: boolean;
  /** "public" (default) leaves out hidden articles; the admin panel asks for "all" or "hidden". */
  visibility?: "public" | "all" | "hidden";
  /**
   * Row order. Unset: newest first, or by relevance when there is a search.
   * Set: that column always, so an admin can sort search results by title or by when they were edited.
   */
  sort?: ArticleSort;
  /** Default "desc" ("asc" for a title sort). */
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

/** A list item plus what the admin table shows on top of a card. */
export interface ArticleListEntry extends ArticleListItem {
  createdAt: string;
  updatedAt: string;
  /** False for a link-only entry (no narration or explanation of its own). */
  hasText: boolean;
}

export interface ArticlePage {
  items: ArticleListEntry[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

export interface ArticleStats {
  total: number;
  indonesian: number;
  english: number;
  hoax: number;
  misleading: number;
  valid: number;
  sources: number;
  hidden: number;
}

function values(a: Article): (string | number | null)[] {
  // sourceSite is NOT NULL in the table; an article written by hand simply has none.
  return [...COLUMNS.map((c) => (c === "sourceSite" ? (a.sourceSite ?? "") : (a[c] ?? null))), a.published === false ? 0 : 1];
}

function db(): DatabaseSync {
  const conn = getDb();
  if (globalForSeed.__hoaxSeeded) return conn;

  const { n } = conn.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  if (n === 0) {
    const insert = conn.prepare(INSERT_SQL);
    conn.exec("BEGIN");
    try {
      // Reverse so "id DESC" tie-breaking keeps the original list order.
      for (const a of [...SEED].reverse()) insert.run(...values(a));
      conn.exec("COMMIT");
    } catch (err) {
      conn.exec("ROLLBACK");
      throw err;
    }
  }
  globalForSeed.__hoaxSeeded = true;
  return conn;
}

function toArticle(row: Row): Article {
  const article = Object.fromEntries(COLUMNS.map((c) => [c, row[c]])) as unknown as Article;
  if (article.originalUrl == null) delete article.originalUrl;
  if (!row.sourceSite) delete article.sourceSite;
  if (row.archiveUrl) article.archiveUrl = String(row.archiveUrl);
  article.published = row.published !== 0;
  return article;
}

function toListItem(row: Row): ArticleListEntry {
  return {
    slug: String(row.slug),
    title: String(row.title),
    lang: row.lang === "en" ? "en" : "id",
    category: String(row.category),
    verdict: row.verdict as Article["verdict"],
    date: String(row.date),
    summary: String(row.summaryEn || row.summaryId || ""),
    image: String(row.image ?? ""),
    sourceSite: String(row.sourceSite ?? ""),
    published: row.published !== 0,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    hasText: row.hasText === 1 || row.hasText === true,
  };
}

/* ---------------------------------------------------------------- search */

// Words too common to say anything about a text's topic.
const STOPWORDS = new Set(
  (
    "yang dan atau tidak untuk dengan ini itu dari pada adalah akan sudah juga karena saja kata mereka sebuah para " +
    "telah dalam bahwa oleh kami kita anda kamu saya dia ada bisa dapat harus lebih sangat hanya seperti jika kalau " +
    "namun tetapi tapi serta agar supaya ketika saat hingga sampai antara setelah sebelum tersebut yaitu yakni pun lagi " +
    "masih banyak semua setiap beberapa secara menjadi merupakan terhadap tentang bagi hal orang tahun hari " +
    "the and that this with from have has had was were are been will would there their they them what which about " +
    "when where who whom your you our not but for can could should into than then also just more most some such " +
    "only over very after before being other these those its his her she him does did doing because while " +
    // The wording of the forwarded message itself, shared by hoaxes on every topic.
    "sebarkan bagikan viral share forward teruskan hati waspada beredar pesan berantai hoaks hoax salah fakta faktanya " +
    "klaim narasi video foto gambar akun unggahan mengunggah whatsapp facebook twitter instagram grup sosial media " +
    "rahasia keluarga teman kalian please everyone friends family shocking warning"
  ).split(" "),
);

/** Distinct lowercase word tokens in order of appearance, folded the way the search index folds them. */
function tokenize(text: string, minLength: number): string[] {
  const seen = new Set<string>();
  const folded = text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  for (const m of folded.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (m[0].length >= minLength) seen.add(m[0]);
  }
  return [...seen];
}

function filterSql(f: ArticleFilter): { where: string[]; params: string[] } {
  const where: string[] = [];
  const params: string[] = [];
  const add = (sql: string, value: string | undefined) => {
    if (!value) return;
    where.push(sql);
    params.push(value);
  };
  const visibility = f.visibility ?? "public";
  if (visibility === "public") where.push("a.published = 1");
  if (visibility === "hidden") where.push("a.published = 0");
  if (f.withText) where.push("(a.explanation != '' OR a.narration != '')");
  else if (f.linkOnly) where.push("a.explanation = '' AND a.narration = ''");
  add("a.lang = ?", f.lang);
  add("a.verdict = ?", f.verdict);
  add("a.sourceSite = ?", f.source);
  add("substr(a.date, 1, 4) = ?", f.year);
  return { where, params };
}

/** ORDER BY for a chosen sort; the id breaks ties so paging is stable. */
function orderSql(sort: ArticleSort, order?: SortOrder): string {
  const dir = (order ?? (sort === "title" ? "asc" : "desc")) === "asc" ? "ASC" : "DESC";
  switch (sort) {
    case "updated":
      return `a.updatedAt ${dir}, a.id ${dir}`;
    case "created":
      return `a.createdAt ${dir}, a.id ${dir}`;
    case "title":
      return `a.title COLLATE NOCASE ${dir}, a.id ${dir}`;
    default:
      return `a.date ${dir}, a.id ${dir}`;
  }
}

interface ListQuery {
  from: string;
  clause: string;
  params: string[];
  order: string;
}

/** FROM, WHERE and ORDER BY of a filtered list; shared by the page query and the CSV export. */
function listQuery(conn: DatabaseSync, filter: ArticleFilter): ListQuery {
  const { where, params } = filterSql(filter);

  let from = "articles a";
  let order = orderSql("date", "desc");
  const q = filter.q ?? "";
  // "vaksin OR vaccine" asks for either word; plain words must all appear.
  const anyWord = /\bOR\b/.test(q);
  const tokens = tokenize(q, 2).filter((t) => t !== "or").slice(0, 12);
  if (tokens.length && hasFts()) {
    from = "articles_fts JOIN articles a ON a.id = articles_fts.rowid";
    order = "bm25(articles_fts, 10.0, 4.0, 1.0, 2.0, 2.0), a.date DESC";
    // The last word may still be half-typed, so it matches as a prefix.
    const match = (joiner: string) => tokens.map((t, i) => `"${t}"${!anyWord && i === tokens.length - 1 ? "*" : ""}`).join(joiner);
    const count = (expr: string) =>
      (conn.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${["articles_fts MATCH ?", ...where].join(" AND ")}`).get(expr, ...params) as { n: number }).n;
    // All words first; any word if that finds nothing.
    const all = match(" ");
    const expr = anyWord || (tokens.length > 1 && count(all) === 0) ? match(" OR ") : all;
    where.unshift("articles_fts MATCH ?");
    params.unshift(expr);
  } else if (filter.q?.trim()) {
    where.push("(a.title LIKE ? OR a.narration LIKE ? OR a.explanation LIKE ?)");
    const like = `%${filter.q.trim()}%`;
    params.push(like, like, like);
  }
  if (filter.sort) order = orderSql(filter.sort, filter.order);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { from, clause, params, order };
}

export const ADMIN_PAGE_SIZES = [25, 50, 100] as const;

/**
 * The admin list's filter from query parameters, shared by /admin/articles,
 * its JSON API and its CSV export. Unlike the public list it sees hidden
 * entries by default and accepts sort, order, text ("with" | "link") and page size.
 */
export function adminArticleFilterFrom(get: (key: string) => string | undefined): ArticleFilter {
  const verdict = get("verdict");
  const lang = get("lang");
  const visibility = get("visibility");
  const sort = get("sort");
  const order = get("order");
  const text = get("text");
  const year = get("year") ?? "";
  const pageSize = Number(get("pageSize"));
  return {
    q: (get("q") ?? "").trim().slice(0, 200) || undefined,
    verdict: verdict === "hoax" || verdict === "misleading" || verdict === "valid" ? verdict : undefined,
    lang: lang === "id" || lang === "en" ? lang : undefined,
    source: (get("source") ?? "").trim().slice(0, 100) || undefined,
    year: /^\d{4}$/.test(year) ? year : undefined,
    withText: text === "with" || undefined,
    linkOnly: text === "link" || undefined,
    visibility: visibility === "public" || visibility === "hidden" ? visibility : "all",
    sort: isArticleSort(sort) ? sort : undefined,
    order: order === "asc" || order === "desc" ? order : undefined,
    page: Number(get("page")) || 1,
    pageSize: (ADMIN_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 25,
  };
}

export async function listArticles(filter: ArticleFilter = {}): Promise<ArticlePage> {
  const conn = db();
  const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
  const { from, clause, params, order } = listQuery(conn, filter);

  const { n: total } = conn.prepare(`SELECT COUNT(*) AS n FROM ${from} ${clause}`).get(...params) as { n: number };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(filter.page ?? 1) || 1, 1), pages);
  const rows = conn
    .prepare(`SELECT ${CARD_COLUMNS} FROM ${from} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { items: rows.map((r) => toListItem(r as Row)), total, page, pages, pageSize };
}

/** The filtered list as CSV, in the list's order, one row per article (no text bodies). */
export function* articlesCsv(filter: ArticleFilter = {}, siteUrl = ""): Generator<string> {
  const conn = db();
  const cols = ["slug", "title", "lang", "category", "verdict", "date", "sourceSite", "published", "hasText", "originalUrl", "archiveUrl", "createdAt", "updatedAt", "url"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  yield "\ufeff" + cols.join(",") + "\n";
  const { from, clause, params, order } = listQuery(conn, filter);
  const rows = conn
    .prepare(`SELECT ${CARD_COLUMNS}, a.originalUrl, a.archiveUrl FROM ${from} ${clause} ORDER BY ${order}`)
    .iterate(...params) as Iterable<Row>;
  for (const r of rows) {
    const out: Record<string, unknown> = { ...r, published: r.published !== 0 ? 1 : 0, hasText: r.hasText ? 1 : 0, url: `${siteUrl}/blog/${r.slug}` };
    yield cols.map((c) => cell(out[c])).join(",") + "\n";
  }
}

/**
 * Published fact-checks about the same thing as `text`. Scores the rarest
 * words of the text against the archive, then keeps only articles that share
 * a real part of them, so an unrelated text returns nothing.
 */
export async function findSimilarArticles(text: string, limit = 4, excludeSlug?: string): Promise<ArticleListItem[]> {
  if (!hasFts()) return [];
  const conn = db();
  const words = tokenize(text, 4).filter((w) => !STOPWORDS.has(w) && !/^\d+$/.test(w)).slice(0, 300);
  if (words.length < 2) return [];

  const { n: total } = conn.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  const vocab = conn
    .prepare(`SELECT term, doc FROM articles_vocab WHERE term IN (${words.map(() => "?").join(", ")})`)
    .all(...words) as { term: string; doc: number }[];
  // Rare words carry the topic; words found in a quarter of the archive carry none.
  const weighted = vocab
    .filter((v) => v.doc <= Math.max(total * 0.25, 3))
    .map((v) => ({ term: v.term, weight: Math.log(1 + total / v.doc) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);
  if (weighted.length < 2) return [];

  const rows = conn
    .prepare(
      `SELECT ${CARD_COLUMNS}, a.narration, a.explanation
       FROM articles_fts JOIN articles a ON a.id = articles_fts.rowid
       WHERE articles_fts MATCH ? AND a.published = 1 AND a.slug != ?
       ORDER BY bm25(articles_fts, 6.0, 4.0, 1.0, 1.0, 1.0) LIMIT 15`,
    )
    .all(weighted.map((w) => `"${w.term}"`).join(" OR "), excludeSlug ?? "") as Row[];

  // A match must share the text's rare words with the claim itself (title and narration), not just
  // somewhere in a long explanation. Scores were calibrated on real hoaxes and on unrelated texts.
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  // The few most distinctive words say what the claim is about (a place, a product, a disease).
  const distinctive = new Set(weighted.slice(0, 3).map((w) => w.term));
  const share = (text: string) => {
    const words = new Set(tokenize(text, 4));
    const shared = weighted.filter((w) => words.has(w.term));
    return {
      hits: shared.length,
      coverage: shared.reduce((sum, w) => sum + w.weight, 0) / totalWeight,
      distinctive: shared.some((w) => distinctive.has(w.term)),
    };
  };
  const scored = rows.map((row) => {
    const head = share(`${row.title} ${String(row.narration).slice(0, 600)}`);
    const all = share(`${row.title} ${row.narration} ${row.explanation}`);
    return { row, headHits: head.hits, onTopic: head.distinctive, score: 0.6 * head.coverage + 0.4 * all.coverage };
  });
  const best = Math.max(0, ...scored.map((c) => c.score));
  // The same claim checked by two sites ("[SALAH] X", "[HOAKS] X") is shown once.
  const claimKey = (title: unknown) =>
    String(title).toLowerCase().replace(/^\s*[[(][^\])]{2,40}[\])]\s*:?\s*/, "").replace(/[^\p{L}\p{N}]+/gu, "");
  const seen = new Set<string>();
  return scored
    .filter((c) => c.headHits >= 2 && c.onTopic && c.score >= Math.max(0.25, 0.45 * best))
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = claimKey(c.row.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((c) => toListItem(c.row));
}

/* ----------------------------------------------------------------- reads */

export async function getArticleBySlug(slug: string, includeHidden = false): Promise<Article | undefined> {
  const row = db()
    .prepare(`${SELECT_SQL} WHERE slug = ?${includeHidden ? "" : " AND published = 1"}`)
    .get(slug);
  return row ? toArticle(row as Row) : undefined;
}

export async function getArticleStats(): Promise<ArticleStats> {
  const row = db()
    .prepare(
      `SELECT
         COALESCE(SUM(published), 0) AS total,
         COALESCE(SUM(published AND lang = 'id'), 0) AS indonesian,
         COALESCE(SUM(published AND lang = 'en'), 0) AS english,
         COALESCE(SUM(published AND verdict = 'hoax'), 0) AS hoax,
         COALESCE(SUM(published AND verdict = 'misleading'), 0) AS misleading,
         COALESCE(SUM(published AND verdict = 'valid'), 0) AS valid,
         COUNT(DISTINCT CASE WHEN published AND sourceSite != '' THEN sourceSite END) AS sources,
         COALESCE(SUM(NOT published), 0) AS hidden
       FROM articles`,
    )
    .get() as Row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) as unknown as ArticleStats;
}

/** Publishers of the imported fact-checks, largest first. "all" counts hidden entries too (admin). */
export async function getSourceCounts(visibility: "public" | "all" = "public"): Promise<{ site: string; count: number }[]> {
  const rows = db()
    .prepare(
      `SELECT sourceSite AS site, COUNT(*) AS count FROM articles
       WHERE ${visibility === "all" ? "1" : "published = 1"} AND sourceSite != '' GROUP BY sourceSite ORDER BY count DESC`,
    )
    .all();
  return rows.map((r) => ({ site: String(r.site), count: Number(r.count) }));
}

export async function getArticleYears(visibility: "public" | "all" = "public"): Promise<string[]> {
  const rows = db()
    .prepare(`SELECT DISTINCT substr(date, 1, 4) AS y FROM articles WHERE ${visibility === "all" ? "1" : "published = 1"} AND date != '' ORDER BY y DESC`)
    .all();
  return rows.map((r) => String(r.y));
}

export async function getSitemapEntries(): Promise<{ slug: string; date: string }[]> {
  // Link-only entries carry no text of their own, so search engines are pointed at the original instead.
  const rows = db()
    .prepare("SELECT slug, date FROM articles WHERE published = 1 AND (explanation != '' OR narration != '') ORDER BY id")
    .all();
  return rows.map((r) => ({ slug: String(r.slug), date: String(r.date) }));
}

/* ---------------------------------------------------------------- writes */

export async function saveArticle(article: Article, originalSlug?: string): Promise<void> {
  const conn = db();
  const key = originalSlug ?? article.slug;
  const update = conn
    .prepare(
      `UPDATE articles SET ${COLUMNS.map((c) => `"${c}" = ?`).join(", ")},
        published = ?, updatedAt = CURRENT_TIMESTAMP WHERE slug = ?`,
    )
    .run(...values(article), key);
  if (update.changes === 0) conn.prepare(INSERT_SQL).run(...values(article));
}

export async function deleteArticle(slug: string): Promise<void> {
  db().prepare("DELETE FROM articles WHERE slug = ?").run(slug);
}

export const BULK_ACTIONS = ["publish", "hide", "delete", "verdict"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export function isBulkAction(v: unknown): v is BulkAction {
  return (BULK_ACTIONS as readonly unknown[]).includes(v);
}

/**
 * One change for many articles, in one transaction: publish, hide, delete, or
 * set the verdict (the category is left alone). Unknown slugs are skipped;
 * returns how many rows changed.
 */
export async function bulkUpdateArticles(slugs: string[], action: BulkAction, verdict?: Article["verdict"]): Promise<number> {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
  if (!unique.length) return 0;
  if (action === "verdict" && !verdict) throw new Error("A verdict is required.");
  const conn = db();
  const sql =
    action === "delete"
      ? "DELETE FROM articles WHERE slug = ?"
      : action === "verdict"
        ? "UPDATE articles SET verdict = ?, updatedAt = CURRENT_TIMESTAMP WHERE slug = ?"
        : `UPDATE articles SET published = ${action === "publish" ? 1 : 0}, updatedAt = CURRENT_TIMESTAMP WHERE slug = ?`;
  const stmt = conn.prepare(sql);
  let changed = 0;
  conn.exec("BEGIN");
  try {
    for (const slug of unique) changed += Number((action === "verdict" ? stmt.run(verdict as string, slug) : stmt.run(slug)).changes);
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
  return changed;
}
