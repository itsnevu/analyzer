/**
 * Downloads Internet Archive (Wayback Machine) copies of link-only articles
 * whose original page is gone: turnbackhoax.id moved to a new system and its
 * old WordPress permalinks now return 404.
 *
 *   npm run fetch:archived        resumable; skips pages already saved
 *
 * One request at a time with a pause in between, as the Archive asks of
 * automated clients. Raw pages are saved gzipped to data/originals/, and
 * `npm run apply:archived` turns them into article text.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { getDb } from "../src/lib/db.ts";

const OUT = path.join(process.cwd(), "data", "originals", "turnbackhoax");
const USER_AGENT = "SYYHoaxAnalyzerArchive/1.0 (+mailto:syyhoaxanalyzer@gmail.com)";
const PAUSE_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const rows = getDb()
  .prepare(
    `SELECT slug, originalUrl, date FROM articles
     WHERE published = 1 AND explanation = '' AND narration = '' AND sourceSite = 'turnbackhoax.id' AND originalUrl IS NOT NULL
     ORDER BY date DESC`,
  )
  .all() as { slug: string; originalUrl: string; date: string }[];

const todo = rows.filter((r) => !fs.existsSync(path.join(OUT, `${r.slug}.html.gz`)) && !fs.existsSync(path.join(OUT, `${r.slug}.miss`)));
console.log(`link-only turnbackhoax articles: ${rows.length}, still to fetch: ${todo.length}`);

async function fetchSnapshot(url: string, year: string): Promise<{ status: number; html: string; final: string }> {
  // "<year>id_" asks for the capture closest to that year, without the Archive's toolbar.
  const res = await fetch(`https://web.archive.org/web/${year}id_/${url}`, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, html: res.ok ? await res.text() : "", final: res.url };
}

let saved = 0;
let missed = 0;
for (const [i, row] of todo.entries()) {
  const year = /^\d{4}/.test(row.date) ? row.date.slice(0, 4) : "2020";
  let result: { status: number; html: string; final: string } | null = null;
  for (const wait of [0, 10_000, 30_000, 60_000]) {
    if (wait) await sleep(wait);
    try {
      result = await fetchSnapshot(row.originalUrl, year);
      if (result.status !== 429 && result.status < 500) break;
    } catch (err) {
      result = { status: 0, html: "", final: String(err) };
    }
  }
  const slugPart = row.originalUrl.replace(/\/+$/, "").split("/").pop() ?? "";
  // A capture of a redirect lands somewhere else (usually the home page); that is not the article.
  const isArticle = result && result.status === 200 && result.html.includes("entry-content") && decodeURIComponent(result.final).includes(slugPart.slice(0, 40));
  if (isArticle && result) {
    const snapshot = result.final.replace(/\/web\/(\d+)id_\//, "/web/$1/");
    fs.writeFileSync(path.join(OUT, `${row.slug}.html.gz`), zlib.gzipSync(`<!-- snapshot: ${snapshot} -->\n${result.html}`));
    saved++;
  } else {
    fs.writeFileSync(path.join(OUT, `${row.slug}.miss`), `${result?.status ?? 0} ${result?.final ?? ""}\n`);
    missed++;
  }
  if ((i + 1) % 25 === 0 || i === todo.length - 1) console.log(`  ${i + 1}/${todo.length}  saved ${saved}, not archived ${missed}`);
  await sleep(PAUSE_MS);
}
console.log(`done: saved ${saved}, not archived ${missed}`);
