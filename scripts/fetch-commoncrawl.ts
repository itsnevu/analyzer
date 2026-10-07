/**
 * Downloads Common Crawl copies of link-only stophoax.id articles. The domain
 * is parked now and the Wayback Machine mostly never saved these pages, but
 * Common Crawl visited the site between 2019 and 2020.
 *
 *   npm run fetch:commoncrawl -- --list-only   build the index and say how many targets have a capture
 *   npm run fetch:commoncrawl -- --dry         also list what would be downloaded, without downloading
 *   npm run fetch:commoncrawl -- --limit 5     download at most 5 pages
 *   npm run fetch:commoncrawl                  resumable; skips pages already saved
 *
 * Two kinds of requests, each one at a time with a pause in between:
 *   1. the CDX index (index.commoncrawl.org), one page at a time, every page
 *      cached under data/originals/commoncrawl/index so re-runs skip the network;
 *   2. the WARC record of each capture (data.commoncrawl.org), read with a
 *      Range request and saved gzipped to data/originals/stophoax.
 * The index server is flaky (504s, dropped connections), so every call is
 * retried with backoff. `npm run apply:commoncrawl` turns the pages into text.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { getDb } from "../src/lib/db.ts";
import {
  CC_DATA,
  CC_INDEX,
  crawlIdOf,
  crawlsBetween,
  decodeBody,
  groupCaptures,
  normalizeUrl,
  parseCdxLines,
  rangeOf,
  splitWarcRecord,
  type CdxRecord,
  type CrawlInfo,
} from "../src/lib/commoncrawl.ts";

const INDEX_DIR = path.join(process.cwd(), "data", "originals", "commoncrawl", "index");
const OUT = path.join(process.cwd(), "data", "originals", "stophoax");
const USER_AGENT = "SYYHoaxAnalyzerArchive/1.0 (+mailto:syyhoaxanalyzer@gmail.com)";
const URL_PATTERN = "stophoax.id/blog/post/*";
const FIRST_CRAWL = "2018-01";
const LAST_CRAWL = "2022-12";
const PAUSE_MS = 1000;
const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIST_ONLY = args.includes("--list-only");
const limitAt = args.indexOf("--limit");
const LIMIT = limitAt >= 0 ? Number(args[limitAt + 1]) || 0 : 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(INDEX_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------- requests */

let lastRequest = 0;
/** At most one request per second, as both Common Crawl servers ask of automated clients. */
async function pace(): Promise<void> {
  const wait = lastRequest + PAUSE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
}

interface Reply {
  status: number;
  body: Buffer;
}

/**
 * GET with retries: network errors, 5xx, 429 and replies the caller rejects
 * (an HTML error page where JSON was expected) are tried again after a growing pause.
 */
async function fetchRetry(url: string, init: RequestInit, accept: (reply: Reply) => boolean): Promise<Reply> {
  let last: Reply = { status: 0, body: Buffer.alloc(0) };
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (attempt) {
      const wait = BACKOFF_MS[attempt - 1];
      console.log(`    retry ${attempt}/${BACKOFF_MS.length} in ${wait / 1000}s (${last.status || "network error"})`);
      await sleep(wait);
    }
    await pace();
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(90_000) });
      last = { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      last = { status: 0, body: Buffer.from(String(err)) };
    }
    if (accept(last)) return last;
    // A definite "no" from the server is not worth retrying.
    if (last.status >= 400 && last.status < 500 && last.status !== 429) return last;
  }
  return last;
}

/* ---------------------------------------------------------------- index */

/** Reads a cached index file, or fetches it and caches it. Returns null when the server would not answer. */
async function cachedJson<T>(file: string, url: string, parse: (reply: Reply) => T | null): Promise<T | null> {
  const at = path.join(INDEX_DIR, file);
  if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8")) as T;
  const reply = await fetchRetry(url, {}, (r) => parse(r) !== null);
  const value = parse(reply);
  if (value === null) return null;
  fs.writeFileSync(at, JSON.stringify(value));
  return value;
}

const isJson = (r: Reply) => r.status === 200 && /^[[{]/.test(r.body.subarray(0, 1).toString());
/** The index answers 404 with a JSON message when a crawl has no capture of the site at all. */
const noCaptures = (r: Reply) => r.status === 404 && /No Captures found/i.test(r.body.toString("utf8"));

async function buildIndex(): Promise<{ captures: Map<string, CdxRecord[]>; crawls: number; pagesMissing: number }> {
  const crawlsAll = await cachedJson<CrawlInfo[]>("collinfo.json", `${CC_INDEX}/collinfo.json`, (r) => {
    if (!isJson(r)) return null;
    try {
      const list = JSON.parse(r.body.toString("utf8")) as CrawlInfo[];
      return Array.isArray(list) && list.length ? list : null;
    } catch {
      return null;
    }
  });
  if (!crawlsAll) throw new Error("could not read collinfo.json from index.commoncrawl.org");
  const crawls = crawlsBetween(crawlsAll, FIRST_CRAWL, LAST_CRAWL);
  console.log(`crawls from ${FIRST_CRAWL} to ${LAST_CRAWL}: ${crawls.length}`);

  const records: CdxRecord[] = [];
  let pagesMissing = 0;
  for (const id of crawls) {
    const base = `${CC_INDEX}/${id}-index?url=${encodeURIComponent(URL_PATTERN)}&output=json`;
    const pages = await cachedJson<number>(`${id}-pages.json`, `${base}&showNumPages=true`, (r) => {
      if (noCaptures(r)) return 0;
      if (!isJson(r)) return null;
      try {
        const n = (JSON.parse(r.body.toString("utf8")) as { pages?: number }).pages;
        return typeof n === "number" ? n : null;
      } catch {
        return null;
      }
    });
    if (pages === null) {
      console.log(`  ${id}: page count unavailable, skipped for now`);
      pagesMissing++;
      continue;
    }
    let found = 0;
    for (let page = 0; page < pages; page++) {
      const lines = await cachedJson<CdxRecord[]>(`${id}-${page}.json`, `${base}&page=${page}`, (r) => {
        if (noCaptures(r)) return [];
        if (r.status !== 200) return null;
        const text = r.body.toString("utf8");
        // The index streams JSON lines; an HTML page here is a gateway error.
        if (!text.trim().startsWith("{")) return null;
        return parseCdxLines(text);
      });
      if (lines === null) {
        console.log(`  ${id}: page ${page} unavailable, skipped for now`);
        pagesMissing++;
        continue;
      }
      records.push(...lines);
      found += lines.length;
    }
    console.log(`  ${id}: ${pages} page${pages === 1 ? "" : "s"}, ${found} records`);
  }
  return { captures: groupCaptures(records), crawls: crawls.length, pagesMissing };
}

/* ------------------------------------------------------------------ main */

const rows = getDb()
  .prepare(
    `SELECT slug, originalUrl FROM articles
     WHERE published = 1 AND explanation = '' AND narration = '' AND sourceSite = 'stophoax.id' AND originalUrl IS NOT NULL
     ORDER BY date DESC`,
  )
  .all() as { slug: string; originalUrl: string }[];
console.log(`link-only stophoax articles: ${rows.length}`);

const { captures, pagesMissing } = await buildIndex();
const withCapture = rows.filter((r) => captures.has(normalizeUrl(r.originalUrl)));
console.log(`captures of stophoax.id/blog/post pages: ${captures.size}`);
console.log(`targets with a capture: ${withCapture.length} of ${rows.length}${pagesMissing ? `  (index incomplete: ${pagesMissing} page${pagesMissing === 1 ? "" : "s"} could not be read; run again later)` : ""}`);
if (LIST_ONLY) process.exit(0);

const saved = (slug: string) => fs.existsSync(path.join(OUT, `${slug}.html.gz`));
const missed = (slug: string) => fs.existsSync(path.join(OUT, `${slug}.miss`));
let todo = rows.filter((r) => !saved(r.slug) && !missed(r.slug));
console.log(`still to fetch: ${todo.length}${LIMIT ? `, limited to ${LIMIT}` : ""}`);
// A target is only written off as "no capture" once the whole index has been read.
const fetchable = todo.filter((r) => captures.has(normalizeUrl(r.originalUrl)) || !pagesMissing);
// A limited run is a trial of the downloads, so targets that have a capture go first.
const hasCapture = (r: { originalUrl: string }) => (captures.has(normalizeUrl(r.originalUrl)) ? 0 : 1);
todo = LIMIT ? fetchable.sort((a, b) => hasCapture(a) - hasCapture(b)).slice(0, LIMIT) : fetchable;

if (DRY) {
  for (const row of todo.slice(0, 20)) {
    const list = captures.get(normalizeUrl(row.originalUrl)) ?? [];
    console.log(`  ${list.length ? `${crawlIdOf(list[0].filename)} ${list[0].timestamp} (${list.length})` : "no capture                    "}  ${row.slug}`);
  }
  if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
  console.log("dry run, nothing downloaded");
  process.exit(0);
}

async function fetchCapture(rec: CdxRecord): Promise<{ html: string; status: number } | { error: string }> {
  const reply = await fetchRetry(`${CC_DATA}/${rec.filename}`, { headers: { Range: rangeOf(rec) } }, (r) => r.status === 206 || r.status === 200);
  if (reply.status !== 206 && reply.status !== 200) return { error: `HTTP ${reply.status || "network error"}` };
  try {
    const record = splitWarcRecord(zlib.gunzipSync(reply.body));
    return { html: decodeBody(record.body, record.httpHeaders["content-type"]), status: record.status };
  } catch (err) {
    return { error: `unreadable record: ${err instanceof Error ? err.message : String(err)}` };
  }
}

let done = 0;
let noCapture = 0;
let unusable = 0;
let failed = 0;
for (const [i, row] of todo.entries()) {
  const list = captures.get(normalizeUrl(row.originalUrl)) ?? [];
  if (!list.length) {
    fs.writeFileSync(path.join(OUT, `${row.slug}.miss`), "no capture in Common Crawl 2018-2022\n");
    noCapture++;
  } else {
    // Newest first; a capture of the parked domain (200, but no article) falls through to an older one.
    let outcome: "saved" | "unusable" | "failed" = "unusable";
    const reasons: string[] = [];
    for (const rec of list) {
      const result = await fetchCapture(rec);
      if ("error" in result) {
        reasons.push(`${rec.timestamp}: ${result.error}`);
        outcome = "failed";
        break;
      }
      if (result.status === 200 && result.html.includes('class="blog-item"')) {
        const header = `<!-- commoncrawl: ${crawlIdOf(rec.filename)} ${rec.timestamp} ${rec.url} -->`;
        fs.writeFileSync(path.join(OUT, `${row.slug}.html.gz`), zlib.gzipSync(`${header}\n${result.html}`));
        outcome = "saved";
        break;
      }
      reasons.push(`${rec.timestamp}: HTTP ${result.status}, not the article`);
    }
    if (outcome === "saved") done++;
    else if (outcome === "failed") {
      // Left for the next run: nothing is written, so the page is tried again.
      console.log(`  ${row.slug}: ${reasons.at(-1)}`);
      failed++;
    } else {
      fs.writeFileSync(path.join(OUT, `${row.slug}.miss`), `no usable capture: ${reasons.join("; ")}\n`);
      unusable++;
    }
  }
  if ((i + 1) % 25 === 0 || i === todo.length - 1) {
    console.log(`  ${i + 1}/${todo.length}  saved ${done}, no capture ${noCapture}, not the article ${unusable}, failed ${failed}`);
  }
}
console.log(`done: saved ${done}, no capture ${noCapture}, not the article ${unusable}, failed (run again) ${failed}`);
