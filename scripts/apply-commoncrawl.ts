/**
 * Turns the Common Crawl copies saved by `npm run fetch:commoncrawl` into
 * article text for link-only stophoax.id entries.
 *
 *   npm run apply:commoncrawl -- --dry       show what would change, and print the first cleaned article
 *   npm run apply:commoncrawl                write it
 *   npm run apply:commoncrawl -- --refresh   also redo text recovered earlier (after a cleaner fix)
 *   npm run apply:commoncrawl -- --show      print the first cleaned article
 *
 * Only rows that still have no text are touched (with --refresh, also rows
 * filled by an earlier run that nobody has edited since), so an edit made in
 * the admin panel is never overwritten. archiveUrl points at the Common Crawl
 * index record the text came from, and the article page credits it.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { captureRecordUrl } from "../src/lib/commoncrawl.ts";
import { getDb } from "../src/lib/db.ts";
import { cleanPost, cleanTitle } from "./legacy-clean.ts";

const DIR = path.join(process.cwd(), "data", "originals", "stophoax");
const DRY = process.argv.includes("--dry");
const REFRESH = process.argv.includes("--refresh");
const SHOW = DRY || process.argv.includes("--show");

/** The element that starts at `start`, found by counting nested <div>s. */
function divBlock(html: string, start: number): string {
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

interface Page {
  crawlId: string;
  url: string;
  title: string;
  content: string;
}

/**
 * The stophoax.id article sits in <div class="blog-item">: its <h1>, a byline
 * list (author, date, categories) and the text in .blog-txt. The box after it
 * ("Sumber:", "Tag:") and the sidebar are page chrome.
 */
function extract(html: string): Page | null {
  const m = html.match(/^<!-- commoncrawl: (\S+) (\d+) (\S+) -->/);
  if (!m) return null;
  const at = html.indexOf('class="blog-item"');
  if (at < 0) return null;
  const content = divBlock(html, html.lastIndexOf("<div", at)).replace(/<a\b[^>]*class="blog-image"[\s\S]*?<\/a>/i, " ");
  const title = html.match(/<h1[^>]*class="[^"]*blog-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  return { crawlId: m[1], url: m[3], title: cleanTitle(title), content };
}

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".html.gz")) : [];
const db = getDb();
// "updatedAt = createdAt" holds only for rows nobody has edited since they were imported.
const writable = `((explanation = '' AND narration = '') OR (${REFRESH ? 1 : 0} AND archiveUrl != '' AND updatedAt = createdAt))`;
const find = db.prepare(`SELECT id, title, originalUrl FROM articles WHERE slug = ? AND ${writable}`);
const update = db.prepare(
  `UPDATE articles SET narration = ?, explanation = ?, reference = ?, source = ?,
     summaryId = CASE WHEN lang = 'id' THEN ? ELSE summaryId END,
     summaryEn = CASE WHEN lang = 'en' THEN ? ELSE summaryEn END,
     archiveUrl = ?
   WHERE id = ? AND ${writable}`,
);

let applied = 0;
let skipped = 0;
let empty = 0;
let shown = false;
db.exec("BEGIN");
try {
  for (const file of files) {
    const slug = file.replace(/\.html\.gz$/, "");
    const row = find.get(slug) as { id: number; title: string; originalUrl: string } | undefined;
    if (!row) {
      skipped++;
      continue;
    }
    const page = extract(zlib.gunzipSync(fs.readFileSync(path.join(DIR, file))).toString("utf8"));
    if (!page) {
      empty++;
      continue;
    }
    const cleaned = cleanPost({
      id: 0,
      date: "",
      slug,
      title: { rendered: page.title || row.title },
      content: { rendered: `${page.content}\nOriginal Source : ${row.originalUrl}` },
      categories: [],
      featured_media: 0,
    });
    if (cleaned.explanation.length < 40) {
      empty++;
      continue;
    }
    if (SHOW && !shown) {
      shown = true;
      console.log(`--- ${slug} (${page.crawlId})`);
      console.log(`title:       ${cleaned.title}`);
      console.log(`summary:     ${cleaned.summary}`);
      console.log(`source:      ${cleaned.source}`);
      console.log(`narration:   ${cleaned.narration.slice(0, 400)}${cleaned.narration.length > 400 ? "…" : ""}`);
      console.log(`explanation: ${cleaned.explanation.slice(0, 1200)}${cleaned.explanation.length > 1200 ? "…" : ""}`);
      console.log(`reference:   ${cleaned.reference.slice(0, 600)}${cleaned.reference.length > 600 ? "…" : ""}`);
      console.log("---");
    }
    if (!DRY) {
      update.run(
        cleaned.narration,
        cleaned.explanation,
        cleaned.reference,
        cleaned.source,
        cleaned.summary,
        cleaned.summary,
        captureRecordUrl(page.crawlId, page.url),
        row.id,
      );
    }
    applied++;
  }
  if (DRY) db.exec("ROLLBACK");
  else db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(`Common Crawl pages found   ${files.length}`);
console.log(`  text recovered           ${applied}${DRY ? " (dry run, nothing written)" : ""}`);
console.log(`  no usable text           ${empty}`);
console.log(`  already had text / gone  ${skipped}${REFRESH ? "" : "  (use --refresh to redo text recovered earlier)"}`);
