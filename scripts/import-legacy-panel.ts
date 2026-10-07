/**
 * Loads the data copied from the legacy detector panel (data/legacy-panel/panel/)
 * into the admin dashboard tables: the dataset's labels and publish dates, the
 * sites it was scraped from and the crawler's listing pages, the detector's
 * search log, and the HOAX SETTING lists (stopwords, HTML entity replacements,
 * skipped domains). Run from the project root:
 *
 *   npm run import:panel            replace the legacy rows
 *   npm run import:panel -- --dry   only print what would happen
 *
 * Safe to re-run. Legacy rows are replaced, but whatever was added in the new
 * admin panel stays: labels given to dataset rows (adminLabel/reviewedAt), source
 * sites added here (origin 'site') and the inactive flag on legacy ones, and
 * stopwords/HTML tags/skip domains (inserted only when missing). Searches made
 * on the new site are kept. Visitor IP addresses in the legacy search log are
 * not imported.
 */

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db.ts";
import { ensurePanelSchema } from "../src/lib/panel-schema.ts";

const DIR = path.join(process.cwd(), "data", "legacy-panel", "panel");
const DRY = process.argv.includes("--dry");

type Row = Record<string, string | null>;

function readGrid(file: string, optional = false): Row[] {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
    if (optional) {
      console.warn(`Missing ${full}, skipped`);
      return [];
    }
    console.error(`Missing ${full}`);
    process.exit(1);
  }
  return (JSON.parse(fs.readFileSync(full, "utf8")) as { rows: Row[] }).rows;
}

// ---- publish dates ------------------------------------------------------------
// The panel stored whatever the source page printed: "Februari18,2022",
// "BySiberKreasi Sep15,2018 DISINFORMASI", "DiscoveredOn: 28Feb2003", "12/05/2020"...

const MONTHS: [string, number][] = [
  ["januari", 1], ["january", 1], ["jan", 1],
  ["februari", 2], ["pebruari", 2], ["february", 2], ["feb", 2],
  ["maret", 3], ["march", 3], ["mar", 3],
  ["april", 4], ["apr", 4],
  ["mei", 5], ["may", 5],
  ["juni", 6], ["june", 6], ["jun", 6],
  ["juli", 7], ["july", 7], ["jul", 7],
  ["agustus", 8], ["august", 8], ["agu", 8], ["agt", 8], ["aug", 8],
  ["september", 9], ["sept", 9], ["sep", 9],
  ["oktober", 10], ["october", 10], ["okt", 10], ["oct", 10],
  ["november", 11], ["nopember", 11], ["nov", 11],
  ["desember", 12], ["december", 12], ["des", 12], ["dec", 12],
];

/** Month from a word that may have other text glued in front ("BySiberKreasiSep"). */
function monthOf(word: string): number | null {
  const w = word.toLowerCase();
  for (const [name, n] of MONTHS) if (w.endsWith(name)) return n;
  return null;
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 1995 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(raw: string, url: string): string | null {
  let m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const r = iso(+m[3], +m[2], +m[1]);
    if (r) return r;
  }
  for (const x of raw.matchAll(/([A-Za-z]+)\.?\s*(\d{1,2}),\s*(\d{4})/g)) {
    const mo = monthOf(x[1]);
    const r = mo && iso(+x[3], mo, +x[2]);
    if (r) return r;
  }
  for (const x of raw.matchAll(/(\d{1,2})\s*([A-Za-z]+)\.?\s*(\d{4})/g)) {
    const mo = monthOf(x[2]);
    const r = mo && iso(+x[3], mo, +x[1]);
    if (r) return r;
  }
  m = url.match(/\/((?:19|20)\d{2})\/(\d{2})\/(\d{2})\//);
  return m ? iso(+m[1], +m[2], +m[3]) : null;
}

// ---- sources ------------------------------------------------------------------

const LANG: Record<string, string> = { "1": "en", "2": "id", "3": "ms" };

function siteOf(url: string): string {
  try {
    return new URL(/^https?:/.test(url) ? url : `https://${url}`).hostname.replace(/^(www|indeks)\./, "");
  } catch {
    return url;
  }
}

const yes = (v: string | null | undefined) => ((v ?? "").trim().toLowerCase() === "yes" ? 1 : 0);

const sources = readGrid("websites.json").map((w) => ({
  id: Number(w.id),
  site: siteOf(w.Website ?? ""),
  url: w.Website ?? "",
  lang: LANG[w.language ?? ""] ?? "",
  description: (w.Description ?? "").trim(),
  htmlPage: (w.html_page ?? "").trim(),
  header: yes(w.header),
  stemming: yes(w.stamming),
  socialMedia: (w.socialmedia ?? "").trim(),
}));

// The crawler's listing pages per site; `stat` was a number in the grid, a word on screen.
const CRAWL_STATUS: Record<string, string> = { "1": "Begin", "2": "Continued", "3": "Finish" };
const crawlQueue = readGrid("crawl-queue.json", true)
  .filter((r) => (r.url ?? "").trim())
  .map((r) => ({
    id: Number(r.id),
    sourceId: Number(r.website) || null, // 0 = not tied to a site
    url: (r.url ?? "").trim(),
    page: Number(r.page) || 0,
    lastPage: Number(r.last_page) || 0,
    suffix: r.suffix ?? "",
    status: CRAWL_STATUS[r.stat ?? ""] ?? "",
  }));

// ---- dataset ------------------------------------------------------------------

const labeledRows = readGrid("hoax-master-data-categorized.json");
const unlabeledRows = readGrid("hoax-master-data-uncategorized.json");

let undated = 0;
const dataset = new Map<number, (string | number | null)[]>();
for (const [rows, labeled] of [[labeledRows, true], [unlabeledRows, false]] as const) {
  for (const r of rows) {
    const id = Number(r.id);
    if (dataset.has(id)) continue; // a labeled copy wins over an unlabeled one
    const url = (r.url ?? "").trim();
    const publishedOn = parseDate(r.publish_date ?? "", url);
    if (!publishedOn) undated++;
    const label = labeled ? (r.text_category ?? "").trim().toUpperCase() || null : null;
    dataset.set(id, [id, label, (r.title ?? "").trim(), publishedOn, url, Number(r.website) || null]);
  }
}

// ---- search log -----------------------------------------------------------------

const searches = readGrid("search-analytic.json")
  .filter((r) => (r.keywords ?? "").trim() && r.input_date)
  .map((r) => [(r.keywords ?? "").trim(), Number(r.id), r.input_date as string]);

// ---- settings -------------------------------------------------------------------

/** Same folding as normalizeWord in src/lib/settings.ts (which cannot be imported here). */
const normalizeWord = (w: string) => w.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim();

const STOPWORD_FILES: [string, string][] = [
  ["stopwords-english.json", "en"],
  ["stopwords-indonesia.json", "id"],
  ["stopwords-malaysia.json", "ms"],
];
const stopwords: { lang: string; word: string }[] = [];
for (const [file, lang] of STOPWORD_FILES) {
  const seen = new Set<string>();
  for (const r of readGrid(file, true)) {
    const word = normalizeWord(r.word ?? "");
    if (!word || word.length > 60 || seen.has(word)) continue;
    seen.add(word);
    stopwords.push({ lang, word });
  }
}

const htmlTags = readGrid("html-tags.json", true)
  .map((r) => ({ tag: (r.Tag ?? "").trim().slice(0, 40), alt: (r.Tag_Alt ?? "").slice(0, 40) }))
  .filter((t) => t.tag);

/** Same rules as normalizeDomain in src/lib/settings.ts. */
function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(s)) s = new URL(s).hostname;
  } catch {
    /* keep as typed */
  }
  return s.replace(/^www\./, "").replace(/\/.*$/, "");
}
const skipDomains = [...new Set(readGrid("url-skip.json", true).map((r) => normalizeDomain(r.url ?? "")).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))];

console.log(`source sites             ${sources.length}`);
console.log(`crawler listing pages    ${crawlQueue.length}`);
console.log(`dataset rows             ${dataset.size}  (labeled ${labeledRows.length}, unlabeled ${unlabeledRows.length}, no readable date ${undated})`);
console.log(`legacy searches          ${searches.length}`);
console.log(`stopwords                ${stopwords.length}  (${STOPWORD_FILES.map(([, l]) => `${l} ${stopwords.filter((s) => s.lang === l).length}`).join(", ")})`);
console.log(`html tags                ${htmlTags.length}  (${new Set(htmlTags.map((t) => t.tag)).size} distinct)`);
console.log(`skip domains             ${skipDomains.length}`);

if (DRY) {
  console.log("dry run, nothing written");
} else {
  const db = getDb();
  ensurePanelSchema(db);

  // What the new panel added, to be put back after the legacy rows are replaced.
  const reviews = db
    .prepare("SELECT id, adminLabel, reviewedAt FROM legacy_dataset WHERE adminLabel IS NOT NULL OR reviewedAt IS NOT NULL")
    .all() as { id: number; adminLabel: string | null; reviewedAt: string | null }[];
  const inactive = new Set((db.prepare("SELECT id FROM legacy_sources WHERE origin = 'legacy' AND active = 0").all() as { id: number }[]).map((r) => r.id));
  const siteSourceIds = new Set((db.prepare("SELECT id FROM legacy_sources WHERE origin = 'site'").all() as { id: number }[]).map((r) => r.id));

  const insertSource = db.prepare(
    `INSERT INTO legacy_sources (id, site, url, lang, description, htmlPage, header, stemming, socialMedia, active, origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy')`,
  );
  const insertRow = db.prepare("INSERT INTO legacy_dataset (id, label, title, publishedOn, url, sourceId) VALUES (?, ?, ?, ?, ?, ?)");
  const reapplyReview = db.prepare("UPDATE legacy_dataset SET adminLabel = ?, reviewedAt = ? WHERE id = ?");
  const insertSearch = db.prepare("INSERT INTO searches (query, legacyId, createdAt, origin) VALUES (?, ?, ?, 'legacy')");
  const insertStopword = db.prepare("INSERT OR IGNORE INTO stopwords (lang, word, origin) VALUES (?, ?, 'legacy')");
  const insertTag = db.prepare("INSERT OR IGNORE INTO html_tags (tag, alt) VALUES (?, ?)");
  const insertSkip = db.prepare("INSERT OR IGNORE INTO skip_domains (domain, note) VALUES (?, 'From the legacy panel')");
  const insertCrawl = db.prepare("INSERT INTO crawl_queue (id, sourceId, url, page, lastPage, suffix, status) VALUES (?, ?, ?, ?, ?, ?, ?)");

  let sourcesSkipped = 0;
  let reviewsKept = 0;
  let newStopwords = 0;
  let newTags = 0;
  let newSkips = 0;
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM legacy_sources WHERE origin = 'legacy'; DELETE FROM legacy_dataset; DELETE FROM searches WHERE origin = 'legacy'; DELETE FROM crawl_queue;");
    for (const s of sources) {
      // A site added in the new panel may sit on this id; it stays.
      if (siteSourceIds.has(s.id)) {
        sourcesSkipped++;
        continue;
      }
      insertSource.run(s.id, s.site, s.url, s.lang, s.description, s.htmlPage, s.header, s.stemming, s.socialMedia, inactive.has(s.id) ? 0 : 1);
    }
    for (const row of dataset.values()) insertRow.run(...row);
    for (const r of reviews) reviewsKept += Number(reapplyReview.run(r.adminLabel, r.reviewedAt, r.id).changes);
    for (const s of searches) insertSearch.run(...s);
    for (const w of stopwords) newStopwords += Number(insertStopword.run(w.lang, w.word).changes);
    for (const t of htmlTags) newTags += Number(insertTag.run(t.tag, t.alt).changes);
    for (const d of skipDomains) newSkips += Number(insertSkip.run(d).changes);
    for (const c of crawlQueue) insertCrawl.run(c.id, c.sourceId, c.url, c.page, c.lastPage, c.suffix, c.status);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  console.log(`written                  ${n("SELECT COUNT(*) AS n FROM legacy_dataset")} dataset rows (${reviewsKept} admin labels kept), ${n("SELECT COUNT(*) AS n FROM searches WHERE origin = 'legacy'")} searches`);
  console.log(`                         ${n("SELECT COUNT(*) AS n FROM legacy_sources WHERE origin = 'legacy'")} legacy sources (${sourcesSkipped} ids taken by sites added here, ${n("SELECT COUNT(*) AS n FROM legacy_sources WHERE origin = 'site'")} added here), ${n("SELECT COUNT(*) AS n FROM crawl_queue")} listing pages`);
  console.log(`                         stopwords ${n("SELECT COUNT(*) AS n FROM stopwords")} (${newStopwords} new), html tags ${n("SELECT COUNT(*) AS n FROM html_tags")} (${newTags} new), skip domains ${n("SELECT COUNT(*) AS n FROM skip_domains")} (${newSkips} new)`);
}
