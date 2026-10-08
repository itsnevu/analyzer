import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { MessageError } from "./message-error";
import { elementContents, firstElement, metaContent, removeComments, removeElements, stripTags, titleText } from "./html-scan";

/**
 * Reads a public web page for the detector ("paste a link"). The server runs
 * on a home network, so every connection is checked: only http(s) on the
 * usual ports, and never an address inside the LAN or on the machine itself
 * (the check runs on the address actually connected to, so DNS tricks do
 * not get around it). Size, time and redirects are capped. Server-only.
 */

const MAX_BYTES = 2 * 1024 * 1024;
/** No data for this long ends the request. */
const TIMEOUT_MS = 8000;
/** The whole read, redirects included, may take at most this long (a server trickling bytes cannot hold a request open). */
const DEADLINE_MS = 20_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; SYYHoaxAnalyzer/1.0; +https://syyhoaxanalyzer.com)";

export class PageError extends MessageError {}

/**
 * Every address range that is not the public internet, IPv4 and IPv6 kept in
 * separate lists. A string check missed IPv6 addresses that embed an IPv4 one
 * (the URL parser rewrites "[::ffff:127.0.0.1]" to "[::ffff:7f00:1]"); those
 * forms are now refused as a whole.
 */
const NON_PUBLIC_V4 = new net.BlockList();
const NON_PUBLIC_V6 = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) NON_PUBLIC_V4.addSubnet(addr, prefix, "ipv4");
// Every IPv6 form that embeds an IPv4 address is refused outright (no public site needs one), with the other special ranges.
for (const [addr, prefix] of [
  ["::", 96], // unspecified, loopback and the old IPv4-compatible form
  ["::ffff:0:0", 96], // IPv4-mapped
  ["::ffff:0:0:0", 96], // IPv4-translated
  ["64:ff9b::", 96], ["64:ff9b:1::", 48], // NAT64, which can reach IPv4 inside the network
  ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], // discard, special purpose (Teredo…), documentation, 6to4
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) NON_PUBLIC_V6.addSubnet(addr, prefix, "ipv6");

/** True for loopback, private, link-local, carrier-grade NAT, multicast and every other non-public address, in any notation. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const family = net.isIP(addr);
  // Not an address at all: refuse rather than guess.
  if (!family) return true;
  return family === 4 ? NON_PUBLIC_V4.check(addr, "ipv4") : NON_PUBLIC_V6.check(addr, "ipv6");
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

/** Lets the caller refuse hosts (the admin skip list) on every hop, redirects included. */
export type HostFilter = (host: string) => string | null;

function checkUrl(raw: string, blockHost?: HostFilter): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageError("That is not a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new PageError("Only http and https links can be read.");
  if (url.username || url.password) throw new PageError("Links with a user name or password are not accepted.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new PageError("Only links on the standard web ports can be read.");
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname)) {
    throw new PageError("That address is not a public website.");
  }
  const refused = blockHost?.(url.hostname.replace(/\.$/, ""));
  if (refused) throw new PageError(refused);
  return url;
}

interface Fetched {
  url: string;
  contentType: string;
  body: Buffer;
}

function request(url: URL, deadline: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const left = deadline - Date.now();
    if (left <= 0) return reject(new PageError("The page took too long to load."));
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
    const timer = setTimeout(() => req.destroy(new PageError("The page took too long to load.")), left);
    req.on("close", () => clearTimeout(timer));
    // Second line of defence: whatever the name resolved to, the address actually connected to must be public.
    req.on("socket", (socket) => {
      socket.once("connect", () => {
        if (socket.remoteAddress && isPrivateAddress(socket.remoteAddress)) req.destroy(new PageError("That address is not a public website."));
      });
    });
    req.on("error", reject);
  });
}

async function fetchPublic(raw: string, blockHost?: HostFilter): Promise<Fetched> {
  let url = checkUrl(raw, blockHost);
  const deadline = Date.now() + DEADLINE_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await request(url, deadline);
    } catch (err) {
      if (err instanceof PageError) throw err;
      throw new PageError("The page could not be reached.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = checkUrl(new URL(res.headers.location, url).toString(), blockHost);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new PageError("That site does not let us read the page (it may need a login).");
    if (res.status >= 400) throw new PageError("The page answered with an error ({status}).", { status: String(res.status) });
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
const meta = (html: string, name: string) => decode(metaContent(html, name)).trim();

/** Elements whose text is page furniture, not the article. */
export const NON_CONTENT_TAGS = ["script", "style", "noscript", "svg", "iframe", "template", "form", "nav", "header", "footer", "aside"] as const;

/** Title and readable text of a page: the article body when there is one, otherwise its paragraphs. Linear in the page size. */
export function extractText(html: string): { title: string; text: string } {
  const title = meta(html, "og:title") || decode(titleText(html)).trim();
  const description = meta(html, "og:description") || meta(html, "description");
  let body = removeElements(removeComments(html), NON_CONTENT_TAGS);
  const article = firstElement(body, "article");
  if (article && article.length > 500) body = article;
  const paragraphs = elementContents(body, ["p", "h1", "h2", "h3", "li", "blockquote"])
    .map((inner) => decode(stripTags(inner)).replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 40);
  const text = [title, description, ...paragraphs].filter((p, i, all) => p && all.indexOf(p) === i).join("\n");
  return { title, text: text.slice(0, 20_000) };
}

function charsetOf(contentType: string, head: string): string {
  return (contentType.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<meta[^<>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
}

/** Fetches a public page (same checks as readPage) and returns its decoded HTML, for callers with their own parser. */
export async function readPageHtml(raw: string, blockHost?: HostFilter): Promise<{ url: string; contentType: string; html: string }> {
  const page = await fetchPublic(raw.trim(), blockHost);
  const head = page.body.subarray(0, 4096).toString("latin1");
  let html: string;
  try {
    html = new TextDecoder(charsetOf(page.contentType, head)).decode(page.body);
  } catch {
    html = page.body.toString("utf8");
  }
  return { url: page.url, contentType: page.contentType, html };
}

/** Fetches a public page and returns its title and readable text. */
export async function readPage(raw: string, blockHost?: HostFilter): Promise<{ url: string; title: string; text: string }> {
  const page = await readPageHtml(raw, blockHost);
  const html = page.html;
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
