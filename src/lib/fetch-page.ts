import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/**
 * Reads a public web page for the detector ("paste a link"). The server runs
 * on a home network, so every connection is checked: only http(s) on the
 * usual ports, and never an address inside the LAN or on the machine itself
 * (the check runs on the address actually connected to, so DNS tricks do
 * not get around it). Size, time and redirects are capped. Server-only.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; SYYHoaxAnalyzer/1.0; +https://syyhoaxanalyzer.com)";

export class PageError extends Error {}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

function safeLookup(hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || !list.length) return callback(new PageError("That address is not a public website."), "");
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageError("That is not a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new PageError("Only http and https links can be read.");
  if (url.username || url.password) throw new PageError("Links with a user name or password are not accepted.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new PageError("Only links on the standard web ports can be read.");
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new PageError("That address is not a public website.");
  }
  return url;
}

interface Fetched {
  url: string;
  contentType: string;
  body: Buffer;
}

function request(url: URL): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      {
        lookup: safeLookup as unknown as net.LookupFunction,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9", "Accept-Encoding": "gzip, deflate, br", "Accept-Language": "id,en;q=0.8" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "");
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) :
          encoding === "deflate" ? res.pipe(zlib.createInflate()) :
          encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) :
          res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new PageError("That page is too large to read."));
          } else chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new PageError("The page took too long to load.")));
    req.on("error", reject);
  });
}

async function fetchPublic(raw: string): Promise<Fetched> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await request(url);
    } catch (err) {
      if (err instanceof PageError) throw err;
      throw new PageError("The page could not be reached.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = checkUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new PageError("That site does not let us read the page (it may need a login).");
    if (res.status >= 400) throw new PageError(`The page answered with an error (${res.status}).`);
    const contentType = String(res.headers["content-type"] ?? "");
    if (!/text\/html|application\/xhtml|text\/plain/.test(contentType)) throw new PageError("That link is not a web page.");
    return { url: url.toString(), contentType, body: res.body };
  }
  throw new PageError("The link redirects too many times.");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’" };
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}
const meta = (html: string, name: string) =>
  decode(
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"))?.[1] ??
      "",
  ).trim();

/** Title and readable text of a page: the article body when there is one, otherwise its paragraphs. */
export function extractText(html: string): { title: string; text: string } {
  const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const description = meta(html, "og:description") || meta(html, "description");
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");
  const article = body.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  if (article && article.length > 500) body = article;
  const paragraphs = [...body.matchAll(/<(p|h[1-3]|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 40);
  const text = [title, description, ...paragraphs].filter((p, i, all) => p && all.indexOf(p) === i).join("\n");
  return { title, text: text.slice(0, 20_000) };
}

function charsetOf(contentType: string, head: string): string {
  return (contentType.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
}

/** Fetches a public page and returns its title and readable text. */
export async function readPage(raw: string): Promise<{ url: string; title: string; text: string }> {
  const page = await fetchPublic(raw.trim());
  const head = page.body.subarray(0, 4096).toString("latin1");
  let html: string;
  try {
    html = new TextDecoder(charsetOf(page.contentType, head)).decode(page.body);
  } catch {
    html = page.body.toString("utf8");
  }
  const { title, text } = page.contentType.includes("text/plain") ? { title: "", text: html.slice(0, 20_000) } : extractText(html);
  if (text.replace(/\s+/g, "").length < 60) {
    throw new PageError("We could not find readable text on that page. Social media posts usually need a login; paste the text instead.");
  }
  return { url: page.url, title: title || new URL(page.url).hostname, text };
}

/** The input is a single link and nothing else. */
export function asSingleUrl(input: string): string | null {
  const t = input.trim();
  return /^https?:\/\/\S+$/i.test(t) && t.length <= 2000 ? t : null;
}
