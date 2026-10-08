import { panelDb } from "./legacy-panel";

/**
 * Detector settings carried over from the legacy panel's HOAX SETTING menu:
 * stopwords per language, HTML entity replacements and domains the link
 * reader must not fetch. Edited at /admin/settings, filled by
 * `npm run import:panel`. Server-only.
 */

export const SETTING_LANGS = [
  { code: "en", name: "English (US)" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
] as const;
export type SettingLang = (typeof SETTING_LANGS)[number]["code"];

export function isSettingLang(v: unknown): v is SettingLang {
  return SETTING_LANGS.some((l) => l.code === v);
}

/** Lowercase, trimmed, accents folded: the form every stored word and every looked-up token share. */
export function normalizeWord(word: string): string {
  return word.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim();
}

/* ------------------------------------------------------------ stopwords */

const cache = new Map<SettingLang, Set<string>>();

/** Stopwords of one language, cached until the list changes. */
export function getStopwords(lang: SettingLang): Set<string> {
  let set = cache.get(lang);
  if (!set) {
    const rows = panelDb().prepare("SELECT word FROM stopwords WHERE lang = ?").all(lang) as { word: string }[];
    set = new Set(rows.map((r) => r.word));
    cache.set(lang, set);
  }
  return set;
}

export interface StopwordRow {
  id: number;
  lang: SettingLang;
  word: string;
  origin: "legacy" | "site";
}

export type StopwordSort = "word" | "origin";

/** Extra choices for listStopwords: which origin, and the order (words A–Z by default). */
export interface StopwordListOptions {
  origin?: "" | "legacy" | "site";
  sort?: StopwordSort;
  order?: "asc" | "desc";
}

export function listStopwords(
  lang: SettingLang,
  q = "",
  page = 1,
  pageSize = 100,
  opts: StopwordListOptions = {},
): { items: StopwordRow[]; total: number; page: number; pages: number; pageSize: number } {
  const db = panelDb();
  const where = ["lang = ?"];
  const args: string[] = [lang];
  if (q) {
    where.push("word LIKE ?");
    args.push(`%${normalizeWord(q)}%`);
  }
  if (opts.origin === "legacy" || opts.origin === "site") {
    where.push("origin = ?");
    args.push(opts.origin);
  }
  const sql = `WHERE ${where.join(" AND ")}`;
  const dir = opts.order === "desc" ? "DESC" : "ASC";
  const order = opts.sort === "origin" ? `ORDER BY origin ${dir}, word` : `ORDER BY word ${dir}`;
  const size = Math.min(Math.max(pageSize, 1), 1000);
  const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM stopwords ${sql}`).get(...args) as { n: number };
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(page, 1), pages);
  // node:sqlite rows have a null prototype, which React refuses to pass to client components; spread them.
  const items = (
    db.prepare(`SELECT id, lang, word, origin FROM stopwords ${sql} ${order} LIMIT ? OFFSET ?`).all(...args, size, (current - 1) * size) as unknown as StopwordRow[]
  ).map((r) => ({ ...r }));
  return { items, total, page: current, pages, pageSize: size };
}

export interface StopwordFilter extends StopwordListOptions {
  lang: SettingLang;
  q: string;
  page: number;
  pageSize: number;
}

/** Reads the stopword grid's state from query parameters: ?lang=id&q=&origin=&sort=word&order=asc&page=1&pageSize=100 */
export function stopwordFilterFrom(get: (key: string) => string | undefined): StopwordFilter {
  const lang = get("lang");
  const origin = get("origin");
  const sort = get("sort");
  const order = get("order");
  return {
    lang: isSettingLang(lang) ? lang : "id",
    q: (get("q") ?? "").trim().slice(0, 60),
    origin: origin === "legacy" || origin === "site" ? origin : "",
    sort: sort === "origin" ? "origin" : "word",
    order: order === "desc" ? "desc" : "asc",
    page: Number(get("page")) || 1,
    pageSize: Number(get("pageSize")) || 100,
  };
}

export function countStopwords(): Record<SettingLang, number> {
  const rows = panelDb().prepare("SELECT lang, COUNT(*) AS n FROM stopwords GROUP BY lang").all() as { lang: string; n: number }[];
  const out: Record<SettingLang, number> = { en: 0, id: 0, ms: 0 };
  for (const r of rows) if (isSettingLang(r.lang)) out[r.lang] = r.n;
  return out;
}

/** Adds words (duplicates ignored); returns how many were new. */
export function addStopwords(lang: SettingLang, words: string[], origin: "legacy" | "site" = "site"): number {
  const db = panelDb();
  const insert = db.prepare("INSERT OR IGNORE INTO stopwords (lang, word, origin) VALUES (?, ?, ?)");
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const raw of words) {
      const word = normalizeWord(raw);
      if (!word || word.length > 60) continue;
      added += Number(insert.run(lang, word, origin).changes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  cache.delete(lang);
  return added;
}

export function removeStopword(id: number): void {
  panelDb().prepare("DELETE FROM stopwords WHERE id = ?").run(id);
  cache.clear();
}

/* ------------------------------------------------------------ HTML tags */

export interface HtmlTagRow {
  id: number;
  tag: string;
  alt: string;
}

export function listHtmlTags(): HtmlTagRow[] {
  return (panelDb().prepare("SELECT id, tag, alt FROM html_tags ORDER BY id").all() as unknown as HtmlTagRow[]).map((r) => ({ ...r }));
}

export function saveHtmlTag(tag: string, alt: string, id?: number): void {
  const t = tag.trim().slice(0, 40);
  if (!t) return;
  if (id) panelDb().prepare("UPDATE html_tags SET tag = ?, alt = ? WHERE id = ?").run(t, alt.slice(0, 40), id);
  else panelDb().prepare("INSERT INTO html_tags (tag, alt) VALUES (?, ?) ON CONFLICT (tag) DO UPDATE SET alt = excluded.alt").run(t, alt.slice(0, 40));
}

export function removeHtmlTag(id: number): void {
  panelDb().prepare("DELETE FROM html_tags WHERE id = ?").run(id);
}

/**
 * Applies the entity replacements to text the way the old panel did: "&#8216;" becomes an apostrophe,
 * "&amp;" an ampersand. Tags that are not entity names ("â€œ", "’") are replaced as they are.
 */
export function applyHtmlTags(text: string): string {
  let out = text;
  for (const { tag, alt } of listHtmlTags()) {
    const needle = /^#?[a-z0-9]+;?$/i.test(tag) ? `&${tag}` : tag;
    out = out.split(needle).join(alt);
  }
  return out;
}

/* ---------------------------------------------------------- skip domains */

export interface SkipDomainRow {
  id: number;
  domain: string;
  note: string;
}

export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(s)) s = new URL(s).hostname;
  } catch {
    /* keep as typed */
  }
  return s.replace(/\/.*$/, "").replace(/\.+$/, "").replace(/^www\./, "");
}

/** For the link reader: the refusal message for a skipped host, checked on every redirect hop. */
export function skipListFilter(host: string): string | null {
  return isSkippedDomain(host) ? "That site is on the skip list, so its pages are not read. Paste the text instead." : null;
}

export function listSkipDomains(): SkipDomainRow[] {
  return (panelDb().prepare("SELECT id, domain, note FROM skip_domains ORDER BY domain").all() as unknown as SkipDomainRow[]).map((r) => ({ ...r }));
}

export function addSkipDomain(domain: string, note = ""): boolean {
  const d = normalizeDomain(domain);
  if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return false;
  return Number(panelDb().prepare("INSERT OR IGNORE INTO skip_domains (domain, note) VALUES (?, ?)").run(d, note.slice(0, 200)).changes) > 0;
}

export function removeSkipDomain(id: number): void {
  panelDb().prepare("DELETE FROM skip_domains WHERE id = ?").run(id);
}

/** True when `host` or one of its parent domains is on the skip list. */
export function isSkippedDomain(host: string): boolean {
  const h = normalizeDomain(host);
  if (!h) return false;
  const parts = h.split(".");
  const candidates = parts.map((_, i) => parts.slice(i).join(".")).filter((c) => c.includes("."));
  if (!candidates.length) return false;
  const row = panelDb()
    .prepare(`SELECT 1 FROM skip_domains WHERE domain IN (${candidates.map(() => "?").join(", ")}) LIMIT 1`)
    .get(...candidates);
  return !!row;
}
