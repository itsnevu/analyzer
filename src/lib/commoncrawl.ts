import zlib from "node:zlib";

/**
 * Pure helpers for reading Common Crawl (index.commoncrawl.org and the WARC
 * files on data.commoncrawl.org). Used by scripts/fetch-commoncrawl.ts and
 * scripts/apply-commoncrawl.ts; no I/O here, so the pieces can be tested.
 */

export const CC_INDEX = "https://index.commoncrawl.org";
export const CC_DATA = "https://data.commoncrawl.org";

/** One line of a CDX index response (output=json). Numbers come as strings. */
export interface CdxRecord {
  urlkey?: string;
  url: string;
  timestamp: string;
  status: string;
  mime?: string;
  "mime-detected"?: string;
  filename: string;
  offset: string;
  length: string;
  digest?: string;
  encoding?: string;
  redirect?: string;
}

export interface CrawlInfo {
  id: string;
  name?: string;
  from?: string;
  to?: string;
}

/** Parses a CDX JSON-lines page; blank lines and junk are skipped. */
export function parseCdxLines(text: string): CdxRecord[] {
  const out: CdxRecord[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    try {
      const rec = JSON.parse(s) as CdxRecord;
      if (rec.url && rec.timestamp && rec.filename) out.push(rec);
    } catch {
      /* a truncated line at the end of a dropped response */
    }
  }
  return out;
}

/**
 * The same page under one key: no scheme, no "www.", no query or fragment, no
 * trailing slash, host lower-cased, percent-encoding decoded where it is safe.
 */
export function normalizeUrl(url: string): string {
  let s = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const cut = s.search(/[?#]/);
  if (cut >= 0) s = s.slice(0, cut);
  const slash = s.indexOf("/");
  const host = (slash >= 0 ? s.slice(0, slash) : s).toLowerCase();
  let path = slash >= 0 ? s.slice(slash) : "";
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep it encoded */
  }
  return `${host}${path.replace(/\/+$/, "")}`;
}

/** Crawl start date as YYYY-MM-DD, from collinfo's "from" or, failing that, the ISO week in the id. */
export function crawlDate(crawl: CrawlInfo): string {
  if (crawl.from && /^\d{4}-\d{2}-\d{2}/.test(crawl.from)) return crawl.from.slice(0, 10);
  const m = crawl.id.match(/^CC-MAIN-(\d{4})-(\d{2})$/);
  if (!m) return "";
  // ISO week 1 contains January 4th.
  const jan4 = Date.UTC(Number(m[1]), 0, 4);
  const day = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (day - 1) * 86_400_000;
  return new Date(monday + (Number(m[2]) - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** Crawl ids whose start month lies in [from, to] (YYYY-MM, inclusive), oldest first. */
export function crawlsBetween(crawls: CrawlInfo[], from: string, to: string): string[] {
  return crawls
    .map((c) => ({ id: c.id, date: crawlDate(c) }))
    .filter((c) => c.date && c.date.slice(0, 7) >= from && c.date.slice(0, 7) <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => c.id);
}

export function isHtmlCapture(rec: CdxRecord): boolean {
  const mime = (rec["mime-detected"] || rec.mime || "").toLowerCase();
  return rec.status === "200" && mime.startsWith("text/html");
}

/**
 * Every successful HTML capture of each page, newest first, keyed by normalized
 * URL. A caller tries the newest and falls back to older ones: the domain was
 * parked later on and its pages still answered 200 without the article.
 */
export function groupCaptures(records: CdxRecord[]): Map<string, CdxRecord[]> {
  const groups = new Map<string, CdxRecord[]>();
  for (const rec of records) {
    if (!isHtmlCapture(rec)) continue;
    const key = normalizeUrl(rec.url);
    const list = groups.get(key) ?? [];
    // The same capture can be listed twice when an index page was fetched twice.
    if (!list.some((r) => r.timestamp === rec.timestamp && r.filename === rec.filename)) list.push(rec);
    groups.set(key, list);
  }
  for (const list of groups.values()) list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return groups;
}

/** The latest successful HTML capture of every page, keyed by normalized URL. */
export function latestCaptures(records: CdxRecord[]): Map<string, CdxRecord> {
  return new Map([...groupCaptures(records)].map(([key, list]) => [key, list[0]]));
}

/** Public index page that shows the capture record this text came from. */
export function captureRecordUrl(crawlId: string, url: string): string {
  return `${CC_INDEX}/${crawlId}-index?url=${encodeURIComponent(url)}&output=json`;
}

/** Crawl id ("CC-MAIN-2020-16") from a WARC file name, or "". */
export function crawlIdOf(filename: string): string {
  return filename.match(/crawl-data\/(CC-MAIN-\d{4}-\d{2})\//)?.[1] ?? "";
}

/** HTTP Range header value for one record in a WARC file. */
export function rangeOf(rec: CdxRecord): string {
  const offset = Number(rec.offset);
  const length = Number(rec.length);
  return `bytes=${offset}-${offset + length - 1}`;
}

/* ------------------------------------------------------------------ WARC */

export interface WarcRecord {
  warcHeaders: Record<string, string>;
  status: number;
  httpHeaders: Record<string, string>;
  body: Buffer;
}

function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    // A repeated header keeps its first value, except Set-Cookie, which nobody here reads.
    if (!(name in out)) out[name] = line.slice(i + 1).trim();
  }
  return out;
}

/** Index of the first blank line (CRLF CRLF or LF LF) at or after `from`, with the separator's length. */
function blankLine(buf: Buffer, from: number): { at: number; len: number } {
  const crlf = buf.indexOf("\r\n\r\n", from);
  const lf = buf.indexOf("\n\n", from);
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) return { at: crlf, len: 4 };
  if (lf >= 0) return { at: lf, len: 2 };
  return { at: -1, len: 0 };
}

/** Joins the chunks of a Transfer-Encoding: chunked body; returns the input when it is not chunked after all. */
export function dechunk(body: Buffer): Buffer {
  const parts: Buffer[] = [];
  let pos = 0;
  while (pos < body.length) {
    const eol = body.indexOf("\r\n", pos);
    if (eol < 0) return body;
    const size = parseInt(body.subarray(pos, eol).toString("ascii").split(";")[0].trim(), 16);
    if (Number.isNaN(size)) return parts.length ? Buffer.concat(parts) : body;
    if (size === 0) break;
    parts.push(body.subarray(eol + 2, eol + 2 + size));
    pos = eol + 2 + size + 2;
  }
  return Buffer.concat(parts);
}

/**
 * Splits one gunzipped WARC "response" record into its WARC headers, the HTTP
 * status and headers, and the body. Chunked or compressed bodies (rare: Common
 * Crawl usually stores them decoded) are undone here.
 */
export function splitWarcRecord(raw: Buffer): WarcRecord {
  if (!raw.subarray(0, 5).equals(Buffer.from("WARC/"))) throw new Error("not a WARC record");
  const w = blankLine(raw, 0);
  if (w.at < 0) throw new Error("WARC record without headers");
  const warcHeaders = parseHeaders(raw.subarray(0, w.at).toString("utf8"));
  const httpStart = w.at + w.len;
  // The WARC Content-Length covers exactly the HTTP block; what follows is the record trailer.
  const declared = Number(warcHeaders["content-length"]);
  const httpEnd = Number.isFinite(declared) && declared > 0 ? Math.min(raw.length, httpStart + declared) : raw.length;
  const h = blankLine(raw, httpStart);
  if (h.at < 0 || h.at >= httpEnd) throw new Error("WARC record without an HTTP response");
  const headerBlock = raw.subarray(httpStart, h.at).toString("latin1");
  const statusLine = headerBlock.split(/\r?\n/)[0] ?? "";
  const status = Number(statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/)?.[1] ?? 0);
  const httpHeaders = parseHeaders(headerBlock.slice(statusLine.length));
  let body = raw.subarray(h.at + h.len, httpEnd);
  if (/chunked/i.test(httpHeaders["transfer-encoding"] ?? "")) body = dechunk(body);
  const encoding = (httpHeaders["content-encoding"] ?? "").toLowerCase();
  try {
    if (encoding === "gzip" || encoding === "x-gzip") body = zlib.gunzipSync(body);
    else if (encoding === "deflate") body = zlib.inflateSync(body);
    else if (encoding === "br") body = zlib.brotliDecompressSync(body);
  } catch {
    /* already decoded by the crawler; keep the bytes as they are */
  }
  return { warcHeaders, status, httpHeaders, body };
}

/** Charset named in a Content-Type header or an HTML <meta>, or "" when none is. */
export function charsetOf(contentType: string | undefined, head: string): string {
  const fromHeader = contentType?.match(/charset\s*=\s*"?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const fromMeta =
    head.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i)?.[1] ??
    head.match(/<\?xml[^>]+encoding\s*=\s*["']([\w-]+)/i)?.[1];
  return (fromMeta ?? "").toLowerCase();
}

/** The page as text, decoded with the charset the server or the page declares (UTF-8 when neither does). */
export function decodeBody(body: Buffer, contentType?: string): string {
  const head = body.subarray(0, 4096).toString("latin1");
  let charset = charsetOf(contentType, head) || "utf-8";
  if (charset === "iso-8859-1" || charset === "latin1" || charset === "ascii" || charset === "us-ascii") charset = "windows-1252";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return body.toString("utf8");
  }
}

/** Last path segment of an article URL, the part the saved file is named after. */
export function slugOf(url: string): string {
  return normalizeUrl(url).split("/").pop() ?? "";
}
