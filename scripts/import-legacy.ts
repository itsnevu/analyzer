/**
 * Imports the legacy archive into the article table. Run from the project root:
 *
 *   npm run import:legacy            add new articles, refresh unedited ones
 *   npm run import:legacy -- --dry   only print what would happen
 *
 * Two sources are combined:
 *   data/legacy-wp/posts/*.json      the public WordPress posts (full text, up to April 2019)
 *   data/legacy-panel/panel/hoax-master-data-categorized.json   the detector's labeled dataset
 *                                    (the authoritative label for each fact-check, up to 2022)
 *
 * Safe to re-run: rows are keyed by the WordPress post id or the dataset row id,
 * and an article that was edited in the admin panel is never overwritten.
 */

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db.ts";
import { slugify } from "../src/lib/slug.ts";
import { cleanDatasetRow, cleanPost, type CleanArticle, type DatasetRow, type LegacyPost } from "./legacy-clean.ts";

const WP_DIR = path.join(process.cwd(), "data", "legacy-wp", "posts");
// Other exports from the panel live in the same folder; only the labeled dataset is articles.
const DATASET_FILE = path.join(process.cwd(), "data", "legacy-panel", "panel", "hoax-master-data-categorized.json");
const DRY = process.argv.includes("--dry");

// When two sites carry the same fact-check, keep the copy from whoever wrote it.
const SOURCE_RANK = [
  "turnbackhoax.id", "kominfo.go.id", "covid19.go.id", "cekfakta.tempo.co", "kompas.com", "liputan6.com",
  "saberhoaks.jabarprov.go.id", "hoax-slayer.com", "truthorfiction.com", "sophos.com", "stophoax.id", "cekfakta.com",
];

const normUrl = (u: string) => {
  let s = u;
  try {
    s = decodeURIComponent(u);
  } catch {
    /* keep as is */
  }
  return s.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
};
const normTitle = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function rank(a: CleanArticle): number {
  const i = SOURCE_RANK.indexOf(a.sourceSite);
  return i < 0 ? SOURCE_RANK.length : i;
}

/** Lower sorts first: the better copy of a duplicated fact-check. */
function better(a: CleanArticle, b: CleanArticle): number {
  return (
    Number(!a.verdict) - Number(!b.verdict) ||
    Number(!a.explanation) - Number(!b.explanation) ||
    rank(a) - rank(b) ||
    Number(!a.label) - Number(!b.label) ||
    b.explanation.length - a.explanation.length ||
    (a.legacyId ?? Infinity) - (b.legacyId ?? Infinity) ||
    (a.datasetId ?? 0) - (b.datasetId ?? 0)
  );
}

function readJsonFiles<T>(dir: string, pick: (json: unknown) => T[]): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => pick(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
}

const posts = readJsonFiles<LegacyPost>(WP_DIR, (j) => (Array.isArray(j) ? (j as LegacyPost[]) : []));
// The panel's grid export is { records, page, total, rows: [...] }.
const datasetRows: DatasetRow[] = fs.existsSync(DATASET_FILE)
  ? ((JSON.parse(fs.readFileSync(DATASET_FILE, "utf8")) as { rows?: DatasetRow[] }).rows ?? []).filter((r) => r && r.url)
  : [];
if (!posts.length && !datasetRows.length) {
  console.error(`Nothing to import: no posts in ${WP_DIR} and no dataset at ${DATASET_FILE}`);
  process.exit(1);
}

const cleaned = posts.map(cleanPost);
// Ordinary news was only the old dataset's "not a hoax" class; it stays in the raw dump.
const news = cleaned.filter((a) => a.kind === "news");
const wpFactChecks = cleaned.filter((a) => a.kind === "factcheck");

/* ---- Attach the dataset's labels to the WordPress copies, collect the rest ---- */

const wpByUrl = new Map<string, CleanArticle>();
const wpByTitle = new Map<string, CleanArticle>();
for (const a of wpFactChecks) {
  if (a.originalUrl) wpByUrl.set(normUrl(a.originalUrl), a);
  const t = normTitle(a.title);
  if (t.length >= 20 && !wpByTitle.has(t)) wpByTitle.set(t, a);
}

let labelled = 0;
let relabelled = 0;
const datasetOnly: CleanArticle[] = [];
for (const row of datasetRows) {
  const d = cleanDatasetRow(row);
  const t = normTitle(d.title);
  const wp = wpByUrl.get(normUrl(d.originalUrl)) ?? (t.length >= 20 ? wpByTitle.get(t) : undefined);
  if (!wp) {
    datasetOnly.push(d);
    continue;
  }
  if (wp.datasetId === null) wp.datasetId = d.datasetId;
  if (d.label && d.label !== wp.label) wp.label = d.label;
  if (d.verdict) {
    labelled++;
    if (wp.verdict !== d.verdict) relabelled++;
    wp.verdict = d.verdict;
    wp.category = d.category;
  }
  if (!wp.date) wp.date = d.date;
  // A WordPress copy that came out empty borrows the dataset's text.
  if (!wp.explanation && d.explanation) {
    wp.explanation = d.explanation;
    wp.narration ||= d.narration;
    wp.reference ||= d.reference;
    wp.source ||= d.source;
    wp.summary = d.summary;
  }
}

/* ---- De-duplicate across both sources ---- */

const db = getDb();
const manualUrls = new Set(
  (db.prepare("SELECT originalUrl FROM articles WHERE legacyId IS NULL AND datasetId IS NULL AND originalUrl IS NOT NULL").all() as { originalUrl: string }[])
    .map((r) => normUrl(r.originalUrl)),
);

const seenUrl = new Set<string>();
const seenTitle = new Set<string>();
const keep: CleanArticle[] = [];
let duplicates = 0;
let alreadyManual = 0;
for (const a of [...wpFactChecks, ...datasetOnly].sort(better)) {
  const url = a.originalUrl ? normUrl(a.originalUrl) : "";
  const title = normTitle(a.title);
  if (url && manualUrls.has(url)) {
    alreadyManual++;
    continue;
  }
  if ((url && seenUrl.has(url)) || (title.length >= 25 && seenTitle.has(title))) {
    duplicates++;
    continue;
  }
  if (url) seenUrl.add(url);
  if (title.length >= 25) seenTitle.add(title);
  keep.push(a);
}

/* ---- Write ---- */

const COLUMNS = [
  "slug", "title", "lang", "category", "verdict", "date", "summaryId", "summaryEn", "source", "narration",
  "explanation", "reference", "image", "originalUrl", "published", "sourceSite", "label", "legacyId", "datasetId",
];
const upsert = (key: "legacyId" | "datasetId") =>
  db.prepare(
    `INSERT INTO articles (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})
     ON CONFLICT (${key}) WHERE ${key} IS NOT NULL DO UPDATE SET
       ${COLUMNS.filter((c) => c !== key).map((c) => `${c} = excluded.${c}`).join(", ")}
     WHERE articles.updatedAt = articles.createdAt`,
  );
// "updatedAt = createdAt" is true only for rows nobody has edited since they were imported.
const upsertWp = upsert("legacyId");
const upsertDataset = upsert("datasetId");

let published = 0;
let linkOnly = 0;
let hidden = 0;
const rows = keep.map((a) => {
  const title = a.title || a.explanation.split("\n")[0].slice(0, 90) || "Untitled fact-check";
  // Anything with a verdict is shown; an entry without text still links to the original fact-check.
  const visible = a.verdict !== null;
  if (!visible) hidden++;
  else if (a.explanation || a.narration) published++;
  else linkOnly++;
  const suffix = a.legacyId !== null ? String(a.legacyId) : `d${a.datasetId}`;
  const slug = `${slugify(title).slice(0, 70).replace(/-+$/, "") || "fact-check"}-${suffix}`;
  const values = [
    slug, title, a.lang, a.category, a.verdict ?? "misleading", a.date,
    a.lang === "id" ? a.summary : "", a.lang === "en" ? a.summary : "",
    a.source, a.narration, a.explanation, a.reference, "", a.originalUrl || null,
    visible ? 1 : 0, a.sourceSite, a.label, a.legacyId, a.datasetId,
  ] as (string | number | null)[];
  return { article: a, values };
});

const bySource = new Map<string, number>();
for (const { article } of rows) bySource.set(article.sourceSite, (bySource.get(article.sourceSite) ?? 0) + 1);

console.log(`WordPress posts read       ${posts.length}`);
console.log(`  ordinary news, skipped   ${news.length}`);
console.log(`dataset rows read          ${datasetRows.length}`);
console.log(`  labels applied           ${labelled}  (verdict changed on ${relabelled})`);
console.log(`  only in the dataset      ${datasetOnly.length}`);
console.log(`duplicates, skipped        ${duplicates}`);
console.log(`already added by hand      ${alreadyManual}`);
console.log(`to import                  ${rows.length}  (full text ${published}, link only ${linkOnly}, hidden ${hidden})`);
console.log(`  by source                ${[...bySource].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s || "?"} ${n}`).join(", ")}`);

if (DRY) {
  console.log("dry run, nothing written");
} else {
  const keepWp = new Set(keep.filter((a) => a.legacyId !== null).map((a) => a.legacyId));
  const keepDataset = new Set(keep.filter((a) => a.legacyId === null).map((a) => a.datasetId));
  const imported = db
    .prepare("SELECT id, legacyId, datasetId FROM articles WHERE (legacyId IS NOT NULL OR datasetId IS NOT NULL) AND updatedAt = createdAt")
    .all() as { id: number; legacyId: number | null; datasetId: number | null }[];
  const stale = imported.filter((r) => (r.legacyId !== null ? !keepWp.has(r.legacyId) : !keepDataset.has(r.datasetId)));
  const remove = db.prepare("DELETE FROM articles WHERE id = ?");
  const clearDatasetId = db.prepare("UPDATE articles SET datasetId = NULL WHERE datasetId = ? AND legacyId IS NULL");
  let written = 0;
  db.exec("BEGIN");
  try {
    for (const r of stale) remove.run(r.id);
    for (const { article, values } of rows) {
      if (article.legacyId !== null) {
        // A dataset row that used to stand alone may now belong to this WordPress copy.
        if (article.datasetId !== null) clearDatasetId.run(article.datasetId);
        written += Number(upsertWp.run(...values).changes);
      } else {
        written += Number(upsertDataset.run(...values).changes);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  const total = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(published), 0) AS p FROM articles").get() as { n: number; p: number };
  console.log(`rows written               ${written}  (removed ${stale.length} no longer in the import)`);
  console.log(`articles in database       ${total.n}  (published ${total.p})`);
}
