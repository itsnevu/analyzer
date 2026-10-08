import { findSimilarArticles } from "./articles";
import type { ArticleListItem } from "./data";
import { getDb } from "./db";
import type { Verdict } from "./detect";
import { asSingleUrl, extractText, NON_CONTENT_TAGS, PageError, readPageHtml } from "./fetch-page";
import { canonicalLink, firstElement, metaContent, removeComments, removeElements, stripTags } from "./html-scan";
import { detectLanguage } from "./language";
import { applyHtmlTags, isSkippedDomain, skipListFilter } from "./settings";
import { MessageError } from "./message-error";
import { slugify } from "./slug";
import { foldText } from "./similarity";

/**
 * "Extract from a page" (/admin/extract): turns a fact-check page, its HTML,
 * or a forwarded message into article fields the editor checks before saving.
 *
 * `parseFactCheck` is pure and tested on its own; `extractArticle` adds the
 * page reader, the entity replacements from settings and the lookup of
 * fact-checks already in the archive. The section and label rules mirror
 * scripts/legacy-clean.ts, which cleaned the imported archive the same way.
 * Server-only.
 */

export class ExtractError extends MessageError {}

export type LabelClass = "hoax" | "misleading" | "true" | "clarification";

/** Verdict and category words, the same as CLASS_RESULT in scripts/legacy-clean.ts. */
export const CLASS_RESULT: Record<LabelClass, { verdict: Verdict; category: string }> = {
  hoax: { verdict: "hoax", category: "Hoax" },
  misleading: { verdict: "misleading", category: "Disinformation" },
  true: { verdict: "valid", category: "Verified" },
  clarification: { verdict: "valid", category: "Clarification" },
};

export interface ExtractInput {
  /** Readable text, one paragraph per line. */
  text: string;
  /** Address of the page, when known. */
  url?: string;
  /** Page title from its metadata, when known. */
  title?: string;
  /** Raw HTML, when the input was HTML: read for the published date and canonical link. */
  html?: string;
}

export interface ExtractedFields {
  title: string;
  slug: string;
  verdict: Verdict;
  category: string;
  /** True when no label was found and "misleading" is only a placeholder. */
  verdictGuessed: boolean;
  /** The label the verdict came from, e.g. "SALAH". */
  verdictTag: string;
  date: string;
  dateFrom: "url" | "meta" | "text" | "today";
  lang: "id" | "en";
  narration: string;
  explanation: string;
  reference: string;
  source: string;
  sourceSite: string;
  summary: string;
  originalUrl: string;
}

export interface Parsed {
  fields: ExtractedFields;
  /** What the parser could not decide, for the editor to check. */
  notes: string[];
}

export interface ExtractResult extends Parsed {
  kind: "url" | "html" | "text";
  /** The page that was read, when the input was a link. */
  source?: { url: string; title: string };
  /** Fact-checks already in the archive about the same claim. */
  similar: ArticleListItem[];
}

/* ---------------------------------------------------------------- labels */

const TITLE_TAGS: [RegExp, LabelClass][] = [
  [/^(SALAH|HOAKS|HOAX|PENIPUAN|FALSE|FITNAH|HASUT|PALSU|SCAM|FAKE)$/, "hoax"],
  [/^(DISINFORMASI|MISINFORMASI|SATIRE?|SATIR|MISLEADING|DISINFORMATION|MISINFORMATION|FRAMING|CAMPURAN|LOGICAL FALLACY|SEBAGIAN SALAH|PARTLY FALSE|MIXED)$/, "misleading"],
  [/^(KLARIFIKASI|CLARIFICATION)$/, "clarification"],
  [/^(FAKTA|BENAR|TRUE|FACT)$/, "true"],
];

const BRACKET = /^\s*[[(]\s*([^\])]{2,40}?)\s*[\])]\s*:?\s*/;
const COLON = /^\s*([A-Z][A-Z ]{2,30}?)\s*:\s+/;

function classOfTag(tag: string): LabelClass | null {
  const up = tag.toUpperCase().trim();
  for (const [re, cls] of TITLE_TAGS) if (re.test(up)) return cls;
  return null;
}

/** Verdict from the title's tag ("[SALAH] …", "HOAKS: …") or wording ("Hoaks …", "… adalah hoaks"). */
export function verdictFromTitle(title: string): { verdict: Verdict; category: string; guessed: boolean; tag: string } {
  let rest = title;
  for (let i = 0; i < 3; i++) {
    const m = rest.match(BRACKET) ?? rest.match(COLON);
    if (!m) break;
    const cls = classOfTag(m[1]);
    if (cls) return { ...CLASS_RESULT[cls], guessed: false, tag: m[1].trim().toUpperCase() };
    rest = rest.slice(m[0].length);
  }
  const t = rest.trim();
  if (/^hoa(ks|x)\b/i.test(t) || /\badalah (hoa(ks|x)|salah|palsu)\s*[.!]?$/i.test(t) || /\bbantah(an)?\b/i.test(t)) {
    return { ...CLASS_RESULT.hoax, guessed: false, tag: "headline" };
  }
  if (/\btak terkait\b/i.test(t) || /\bmenyesatkan\b/i.test(t)) return { ...CLASS_RESULT.misleading, guessed: false, tag: "headline" };
  return { ...CLASS_RESULT.misleading, guessed: true, tag: "" };
}

/* ----------------------------------------------------------------- dates */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  januari: 1, februari: 2, maret: 3, mei: 5, juni: 6, juli: 7, agustus: 8, agu: 8, agt: 8, oktober: 10, okt: 10, nopember: 11, nop: 11, desember: 12, des: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

function iso(y: number, m: number, d: number): string {
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!(y >= 1995 && y <= maxYear && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  // "31 Februari" is not a date.
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "/2019/04/06/" in a WordPress-style address. */
export function dateFromUrl(url: string): string {
  const m = url.match(/\/((?:19|20)\d\d)\/(\d{1,2})\/(\d{1,2})\//);
  return m ? iso(+m[1], +m[2], +m[3]) : "";
}

// metaContent comes from ./html-scan, which reads tags in linear time.

/** The published date a page declares: article:published_time, datePublished (JSON-LD) or a date meta tag. */
export function dateFromHtml(html: string): string {
  const raw =
    metaContent(html, "article:published_time") ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ||
    metaContent(html, "datePublished") ||
    metaContent(html, "date") ||
    metaContent(html, "DC.date.issued") ||
    "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? iso(+m[1], +m[2], +m[3]) : dateInText(raw);
}

/** The first Indonesian or English date in a text: "28 Maret 2019", "March 28, 2019", "28/03/2019", "2019-03-28". */
export function dateInText(text: string): string {
  const re = new RegExp(
    `\\b(\\d{1,2})\\s+(${MONTH_RE})\\.?,?\\s+(\\d{4})\\b|\\b(${MONTH_RE})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b|\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})\\b|\\b(\\d{4})-(\\d{2})-(\\d{2})\\b`,
    "gi",
  );
  for (const m of text.matchAll(re)) {
    let d = "";
    if (m[1]) d = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    else if (m[4]) d = iso(+m[6], MONTHS[m[4].toLowerCase()], +m[5]);
    else if (m[7]) d = iso(+m[9], +m[8], +m[7]);
    else d = iso(+m[10], +m[11], +m[12]);
    if (d) return d;
  }
  return "";
}

/* ----------------------------------------------------------------- sites */

/** Hostname without "www.", or "" when the text is not a link. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Groups sub-domains so "nasional.kompas.com" and "regional.kompas.com" are one source, as legacy-clean does. */
export function sourceGroup(host: string): string {
  const m = host.match(/(?:^|\.)((?:kompas|detik|liputan6|tribunnews|hoax-slayer)\.(?:com|net))$/);
  if (m) return m[1] === "hoax-slayer.net" ? "hoax-slayer.com" : m[1];
  if (host === "jabarsaberhoaks.jabarprov.go.id") return "saberhoaks.jabarprov.go.id";
  return host;
}

const SITE_SUFFIX =
  /\s+[-–—|:]\s+(turn ?back ?hoax(\.id)?|cek fakta( liputan6\.com| tempo\.co)?|hoax[- ]slayer|hoax buster(\s*\|\s*covid19\.go\.id)?|kompas\.com|liputan6\.com|tempo\.co|detik ?news|detik\.?com|tribunnews(\.com)?|mafindo|kominfo|komdigi|antara news|snopes(\.com)?|truth or fiction|truthorfiction\.com)\s*$/i;

/** "Title - TurnBackHoax" becomes "Title"; a tail naming the page's own site is dropped too. */
export function stripSiteSuffix(title: string, host = ""): string {
  let t = title.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) {
    const before = t;
    t = t.replace(SITE_SUFFIX, "");
    const parts = host.split(".").filter(Boolean);
    const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const m = label && label.length >= 4 ? t.match(/^(.*\S)\s+[-–—|]\s+([^-–—|]{1,60})$/) : null;
    if (m && foldText(m[2]).replace(/[^a-z0-9]/g, "").includes(label)) t = m[1];
    if (t === before) break;
  }
  return t.replace(/\s*[;:]\s*$/, "").trim();
}

/* -------------------------------------------------------------- sections */

type Section = "preamble" | "source" | "narration" | "explanation" | "reference" | "category";

// Spellings as they occur on the fact-checking sites, typos included.
const HEADINGS: [RegExp, Section][] = [
  [/^(sumber|source|sumber (hoax|hoaks|hasut|isu|fitnah|klaim|informasi))$/i, "source"],
  [/^(narasi|narration|narasi yang beredar|narasi dalam gambar|narasi lanjutan|informasi yang beredar|berikut narasi lengkapnya|klaim|claim|hoaks|hoax|isu|disinformasi|unggahan)$/i, "narration"],
  [
    /^(penjelasan|penejelasan|penjelasan lengkap|penjelasan & fakta|keterangan|kesimpulan|pemeriksaa?n fakta|hasil periksa fakta|hasil cek fakta|penelusuran fakta|penelusuran|fakta|faktanya|klarifikasi|isi klarifikasi( lengkap)?|konfirmasi|explanation|fact check|facts|analysis|brief analysis|detailed analysis|verdict|conclusion|rating)$/i,
    "explanation",
  ],
  [/^(referensi|refrensi|rujukan|reference|references|link counter|counter|sumber klarifikasi|sumber fakta|sumber lain|sumber diskusi|tautan pendukung|further reading)$/i, "reference"],
  [/^(kategori|kategori hoaks|category|ketegori)$/i, "category"],
];

const HEADING_LINE = /^\[?\s*([A-Za-z][A-Za-z &/]{2,40}?)\s*\]?\s*(?::\s*(.*))?$/;

function headingOf(line: string): { section: Section; rest: string } | null {
  const m = line.match(HEADING_LINE);
  if (!m) return null;
  const label = m[1].trim();
  for (const [re, section] of HEADINGS) if (re.test(label)) return { section, rest: (m[2] ?? "").trim() };
  return null;
}

// Headings the old panel's scraper left inline, in capitals: "… PENJELASAN: …".
const INLINE_HEADING = /\s+(?=\[?(KATEGORI|SUMBER(?: KLARIFIKASI)?|NARASI(?: DALAM GAMBAR| LANJUTAN)?|PENJELASAN|REFERENSI|HASIL PERIKSA FAKTA|KESIMPULAN|FAKTA)\]?\s*:)/;

const JUNK: RegExp[] = [
  /^(?:[=\-_*~#]\s*){3,}$/,
  /^(Share|Tweet|Send|Bagikan|Reddit|WhatsApp|Email|Advertisement|Loading\.\.\.|Baca Juga:?)$/i,
  /^Baca (juga|selengkapnya)\b/i,
  /^Selengkapnya\b/i,
  /^Share [\d.,]+[km]?$/i,
  /^The post .* appeared first on /i,
  /^\d+ media telah memverifikasi klaim ini$/i,
  // Bylines: "Penulis: Nama", "By Kemkominfo", "Oleh Admin TurnBackHoax" (capitalised words only, so "Oleh karena itu…" stays).
  /^(Penulis|Editor|Reporter|Author)\s*:\s*\S.{0,60}$/i,
  /^(Oleh|By)\s+[A-Z][\w.'-]*(\s+[A-Z][\w.'-]*){0,4}$/,
  /^Please enable JavaScript/i,
  /^Lanjutkan Membaca/i,
  /^Saksikan video pilihan/i,
];

const norm = (s: string) => foldText(s).replace(/[^\p{L}\p{N}]+/gu, "");

/** True when a line is the title again: possibly truncated, without its label, or still carrying the site's suffix. */
function isTitleLine(line: string, title: string): boolean {
  const a = norm(line);
  if (a.length < 8) return false;
  const full = norm(title);
  const bare = norm(title.replace(BRACKET, ""));
  if (a === full || a === bare) return true;
  if (a.length >= 14 && (full.startsWith(a) || bare.startsWith(a))) return true;
  return full.length >= 14 && a.startsWith(full) && a.length - full.length <= 30;
}

const URL_RE = /https?:\/\/[^\s<>"'()\][]+/g;

/** First two sentences of a text, at most `max` characters. */
export function summarize(text: string, max = 300): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const sentences = flat.split(/(?<=[.!?]["”’)]?)\s+(?=[^a-z])/).filter(Boolean);
  let out = "";
  for (const s of sentences.slice(0, 2)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (!out) {
    const cut = flat.slice(0, max - 1);
    out = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
  }
  return out;
}

const FORWARD_MARKERS = /\b(sebarkan|bagikan|share|forward|teruskan|viral|please share|copas|copy paste|dari grup sebelah|info penting|tolong)\b|!!!|📢|🙏/i;

/** True when the input is HTML rather than text. */
export function looksLikeHtml(s: string): boolean {
  return /<\s*(html|body|article|p|div|h[1-6]|br|meta|title|span)\b/i.test(s) && (s.match(/<[a-z][^>]*>/gi)?.length ?? 0) >= 3;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", laquo: "«", raquo: "»", bull: "•", middot: "·", copy: "©",
};
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const BLOCK_TAG =
  /<\/?(p|div|h[1-6]|li|ul|ol|dl|dt|dd|table|thead|tbody|tr|td|th|blockquote|figure|figcaption|section|article|header|footer|aside|nav|pre|address)\b[^<>]*>|<hr\b[^<>]*>|<br\b[^<>]*>/gi;

/**
 * A page's text, one line per block element, the way a browser shows it.
 * Unlike fetch-page's extractText (tuned for the detector) it keeps short
 * lines, because "NARASI:" and "PENJELASAN:" are exactly the lines a
 * fact-check page is parsed by.
 */
export function htmlToLines(html: string): string[] {
  let body = removeElements(removeComments(html), NON_CONTENT_TAGS);
  const main = firstElement(body, "article") ?? firstElement(body, "main");
  if (main && main.length > 500) body = main;
  const text = decodeEntities(stripTags(body.replace(/\s+/g, " ").replace(BLOCK_TAG, "\n")));
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Parses readable text (and what is known about its page) into article fields. Pure. */
export function parseFactCheck(input: ExtractInput): Parsed {
  const notes: string[] = [];
  const url = input.url?.trim() ?? "";
  const html = input.html ?? "";
  const originalUrl = url || (html ? metaContent(html, "og:url") || canonicalLink(html) || "" : "");
  const host = hostOf(originalUrl);

  // Lines, with the old panel's inline headings split onto lines of their own.
  let lines = input.text
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((l) => l.split(INLINE_HEADING))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !JUNK.some((re) => re.test(l)));

  // Title: the page's own, else the first short line, else the opening of the text.
  let title = (input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title && lines.length) {
    const first = lines[0];
    title = first.length <= 120 ? first : `${first.slice(0, 100).replace(/\s+\S*$/, "")}…`;
    if (first.length > 120) notes.push("No title found; the opening words are used instead.");
  }
  title = stripSiteSuffix(title, host);
  while (lines.length && isTitleLine(lines[0], title)) lines.shift();

  // Date: the address, the page's metadata, then the first date in the text.
  let date = dateFromUrl(originalUrl);
  let dateFrom: ExtractedFields["dateFrom"] = "url";
  if (!date && html) {
    date = dateFromHtml(html);
    dateFrom = "meta";
  }
  if (!date) {
    date = dateInText(lines.slice(0, 12).join("\n")) || dateInText(lines.join("\n"));
    dateFrom = "text";
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
    dateFrom = "today";
    notes.push("No publication date found; today's date is used.");
  }
  // A line that is only a date (a byline) is not part of the article.
  lines = lines.filter((l) => !(l.length < 40 && dateInText(l) && norm(l).length <= 24));

  // Sections.
  const sections: Record<Section, string[]> = { preamble: [], source: [], narration: [], explanation: [], reference: [], category: [] };
  let current: Section = "preamble";
  let headed = false;
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      headed = true;
      if (/^\[?\s*kesimpulan/i.test(line) && sections.explanation.length) sections.explanation.push("Kesimpulan:");
      current = h.section;
      if (h.rest) sections[current].push(h.rest);
      continue;
    }
    sections[current].push(line);
    if (current === "category") current = sections.explanation.length ? "explanation" : "preamble";
  }
  const join = (xs: string[]) => xs.join("\n").trim();
  let narration = join(sections.narration);
  let explanation = join(sections.explanation);
  const preamble = join(sections.preamble);
  const source = join(sections.source);

  if (!headed) {
    const message = !url && !html && (FORWARD_MARKERS.test(preamble) || preamble.length < 1500);
    if (message) {
      narration = preamble;
      notes.push("No section headings found and the text reads like the message itself, so it is filed as the narration; write the fact-check under Explanation.");
    } else {
      explanation = preamble;
      notes.push("No NARASI / PENJELASAN headings found; the whole text is filed as the explanation.");
    }
  } else {
    if (!explanation) explanation = preamble;
    else if (preamble && !norm(explanation).startsWith(norm(preamble).slice(0, 80))) explanation = `${preamble}\n${explanation}`;
    if (!explanation && narration) notes.push("The page has a narration but no explanation section.");
  }

  // References: the section's lines plus every link in the text, one per line.
  const urls = new Set<string>();
  for (const m of input.text.matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;:!?]+$/, "");
    if (u !== originalUrl && u !== url) urls.add(u);
  }
  // A reference line that is only a link is already in the link list.
  const referenceLines = sections.reference.filter((l) => !urls.has(l.replace(/[.,;:!?]+$/, "")));
  const reference = [...referenceLines, ...urls].join("\n").trim();

  const v = verdictFromTitle(title);
  if (v.guessed) notes.push('No verdict label such as [SALAH] or [KLARIFIKASI] in the title; "Misleading" is only a guess.');
  const lang = detectLanguage(`${title}\n${narration}\n${explanation}`).lang;

  return {
    fields: {
      title,
      slug: slugify(title),
      verdict: v.verdict,
      category: v.category,
      verdictGuessed: v.guessed,
      verdictTag: v.tag,
      date,
      dateFrom,
      lang,
      narration,
      explanation,
      reference,
      source,
      sourceSite: sourceGroup(host),
      summary: summarize(explanation || narration),
      originalUrl,
    },
    notes,
  };
}

/** Reads a link, HTML or text and returns the fields plus the archive's matching fact-checks. */
export async function extractArticle(raw: string): Promise<ExtractResult> {
  const input = raw.trim();
  if (!input) throw new ExtractError("Paste a link, a page's HTML or the text of a message.");
  let parsed: Parsed;
  let kind: ExtractResult["kind"];
  let source: ExtractResult["source"];

  const link = asSingleUrl(input);
  if (link) {
    const host = new URL(link).hostname;
    if (isSkippedDomain(host)) throw new ExtractError("{host} is on the skip list (Settings → Skipped domains), so its pages are not read.", { host });
    // The whole page is read, not the detector's "readable text", so short heading lines (NARASI:, PENJELASAN:)
    // and the page's own metadata (publish date) survive.
    const page = await readPageHtml(link, skipListFilter);
    const plain = page.contentType.includes("text/plain");
    const { title, text } = plain ? { title: "", text: page.html.slice(0, 20_000) } : extractText(page.html);
    const lines = plain ? [] : htmlToLines(page.html);
    const body = lines.length ? lines.join("\n") : text;
    if (body.replace(/\s+/g, "").length < 60) {
      throw new PageError("We could not find readable text on that page. Social media posts usually need a login; paste the text instead.");
    }
    const pageTitle = title || new URL(page.url).hostname;
    source = { url: page.url, title: pageTitle };
    parsed = parseFactCheck({ text: applyHtmlTags(body), url: page.url, title: pageTitle, html: plain ? undefined : page.html });
    kind = "url";
  } else if (looksLikeHtml(input)) {
    // extractText gives the page's title; the body is read block by block so heading lines survive.
    const { title, text } = extractText(input);
    const lines = htmlToLines(input);
    parsed = parseFactCheck({ text: applyHtmlTags(lines.length ? lines.join("\n") : text), title, html: input });
    kind = "html";
  } else {
    parsed = parseFactCheck({ text: applyHtmlTags(input) });
    kind = "text";
  }

  const { title, narration } = parsed.fields;
  const similar = await findSimilarArticles(`${title}\n${narration}`, 5).catch((err) => {
    console.error("[extract] archive lookup failed:", err);
    return [] as ArticleListItem[];
  });
  return { ...parsed, kind, source, similar };
}

/**
 * Records which site a saved article came from. The article API does not
 * write this column, so the extract tool sets it right after saving.
 */
export function setSourceSite(slug: string, site: string): boolean {
  const clean = site.trim().toLowerCase().slice(0, 100);
  if (!/^[a-z0-9.-]+$/.test(clean)) return false;
  const r = getDb().prepare("UPDATE articles SET sourceSite = ? WHERE slug = ?").run(clean, slug);
  return Number(r.changes) > 0;
}
