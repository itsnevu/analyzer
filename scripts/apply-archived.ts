/**
 * Turns the Internet Archive copies saved by `npm run fetch:archived` into
 * article text for link-only entries.
 *
 *   npm run apply:archived -- --dry   show what would change
 *   npm run apply:archived            write it
 *
 * Only rows that still have no text are touched, so an edit made in the admin
 * panel is never overwritten; the Archive copy used is kept in archiveUrl and
 * credited on the article page.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { getDb } from "../src/lib/db.ts";
import { cleanPost, cleanTitle } from "./legacy-clean.ts";

const DIR = path.join(process.cwd(), "data", "originals", "turnbackhoax");
const DRY = process.argv.includes("--dry");

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

function extract(html: string): { snapshot: string; title: string; content: string } | null {
  const snapshot = html.match(/^<!-- snapshot: (\S+) -->/)?.[1] ?? "";
  const at = html.indexOf('class="entry-content');
  if (at < 0) return null;
  const content = divBlock(html, html.lastIndexOf("<div", at))
    // Share buttons, "related posts" and the like sometimes sit inside the content block.
    .replace(/<div[^>]+class="[^"]*(sharedaddy|jp-relatedposts|addtoany|mh-social|wpcnt)[^"]*"[\s\S]*$/i, "")
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, " ");
  const title = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  return { snapshot, title: cleanTitle(title), content };
}

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".html.gz")) : [];
const db = getDb();
const find = db.prepare("SELECT id, title, originalUrl FROM articles WHERE slug = ? AND explanation = '' AND narration = ''");
const update = db.prepare(
  `UPDATE articles SET narration = ?, explanation = ?, reference = ?, source = ?,
     summaryId = CASE WHEN lang = 'id' THEN ? ELSE summaryId END,
     summaryEn = CASE WHEN lang = 'en' THEN ? ELSE summaryEn END,
     archiveUrl = ?
   WHERE id = ? AND explanation = '' AND narration = ''`,
);

let applied = 0;
let skipped = 0;
let empty = 0;
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
    if (!DRY) {
      update.run(cleaned.narration, cleaned.explanation, cleaned.reference, cleaned.source, cleaned.summary, cleaned.summary, page.snapshot, row.id);
    }
    applied++;
  }
  if (DRY) db.exec("ROLLBACK");
  else db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(`archived pages found       ${files.length}`);
console.log(`  text recovered           ${applied}${DRY ? " (dry run, nothing written)" : ""}`);
console.log(`  no usable text           ${empty}`);
console.log(`  already had text / gone  ${skipped}`);
