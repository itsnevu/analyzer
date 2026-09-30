/**
 * Loads the data copied from the legacy detector panel (data/legacy-panel/panel/)
 * into the admin dashboard tables: the dataset's labels and publish dates, the
 * sites it was scraped from, and the detector's search log. Run from the
 * project root:
 *
 *   npm run import:panel            replace the legacy rows
 *   npm run import:panel -- --dry   only print what would happen
 *
 * Safe to re-run: legacy rows are replaced, searches made on the new site are
 * kept. Visitor IP addresses in the legacy search log are not imported.
 */

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db.ts";
import { ensurePanelSchema } from "../src/lib/panel-schema.ts";

const DIR = path.join(process.cwd(), "data", "legacy-panel", "panel");
const DRY = process.argv.includes("--dry");

type Row = Record<string, string | null>;

function readGrid(file: string): Row[] {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
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

const sources = readGrid("websites.json").map((w) => ({
  id: Number(w.id),
  site: siteOf(w.Website ?? ""),
  url: w.Website ?? "",
  lang: LANG[w.language ?? ""] ?? "",
  description: (w.Description ?? "").trim(),
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

console.log(`source sites             ${sources.length}`);
console.log(`dataset rows             ${dataset.size}  (labeled ${labeledRows.length}, unlabeled ${unlabeledRows.length}, no readable date ${undated})`);
console.log(`legacy searches          ${searches.length}`);

if (DRY) {
  console.log("dry run, nothing written");
} else {
  const db = getDb();
  ensurePanelSchema(db);
  const insertSource = db.prepare("INSERT INTO legacy_sources (id, site, url, lang, description) VALUES (?, ?, ?, ?, ?)");
  const insertRow = db.prepare("INSERT INTO legacy_dataset (id, label, title, publishedOn, url, sourceId) VALUES (?, ?, ?, ?, ?, ?)");
  const insertSearch = db.prepare("INSERT INTO searches (query, legacyId, createdAt, origin) VALUES (?, ?, ?, 'legacy')");
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM legacy_sources; DELETE FROM legacy_dataset; DELETE FROM searches WHERE origin = 'legacy';");
    for (const s of sources) insertSource.run(s.id, s.site, s.url, s.lang, s.description);
    for (const row of dataset.values()) insertRow.run(...row);
    for (const s of searches) insertSearch.run(...s);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  console.log(`written                  ${n("SELECT COUNT(*) AS n FROM legacy_dataset")} dataset rows, ${n("SELECT COUNT(*) AS n FROM searches WHERE origin = 'legacy'")} searches`);
}
