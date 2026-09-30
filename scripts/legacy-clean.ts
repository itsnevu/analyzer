/**
 * Cleaner for the legacy WordPress dump in data/legacy-wp.
 *
 * Every legacy post is a raw copy of a page from another site (turnbackhoax.id,
 * stophoax.id, kominfo.go.id, hoax-slayer, ...), with that site's navigation,
 * share widgets and "related posts" inside the body. This module turns one post
 * into structured article fields. It has no dependencies besides the language
 * heuristic, so it can run as a plain Node script.
 */

import { detectLanguage } from "../src/lib/language.ts";

export interface LegacyPost {
  id: number;
  date: string;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  categories: number[];
  featured_media: number;
}

export type Verdict = "valid" | "misleading" | "hoax";

/** What kind of statement a post makes, before it is folded into a verdict. */
export type LabelClass = "hoax" | "misleading" | "true" | "clarification" | "news" | "education" | "alert";

export interface CleanArticle {
  /** Post id on the legacy WordPress site, or null for rows that only exist in the detector dataset. */
  legacyId: number | null;
  /** Row id in the legacy detector's labeled dataset, when the article came from or was matched to it. */
  datasetId: number | null;
  title: string;
  lang: "id" | "en";
  /** "news" = ordinary reporting used as the non-hoax class; never shown in the archive. */
  kind: "factcheck" | "news";
  /** Class label from the legacy dataset ("HOAX", "DISINFORMATION", "FACT", ...) or, failing that, from the cover image. */
  label: string;
  /** null when no verdict could be determined; such posts stay hidden until reviewed. */
  verdict: Verdict | null;
  category: string;
  /** YYYY-MM-DD of the original publication, or "" when unknown. */
  date: string;
  sourceSite: string;
  originalUrl: string;
  source: string;
  narration: string;
  explanation: string;
  reference: string;
  summary: string;
}

/* ------------------------------------------------------------------ text */

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', lt: "<", gt: ">", apos: "'", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™",
  bull: "•", middot: "·", deg: "°", times: "×", frac12: "½", eacute: "é", egrave: "è", agrave: "à", uuml: "ü",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(n: number): string {
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

// cp1252 characters that stand for the bytes 0x80-0x9F.
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const CONT =
  "[\\u0080-\\u00bf" +
  Object.keys(CP1252).map((c) => "\\u" + Number(c).toString(16).padStart(4, "0")).join("") +
  "]";
const MOJIBAKE = new RegExp(
  `[\\u00c2-\\u00df]${CONT}|[\\u00e0-\\u00ef]${CONT}{2}|[\\u00f0-\\u00f4]${CONT}{3}`,
  "g",
);
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

/** Repairs UTF-8 text that was decoded as cp1252 ("â€œ" back to "“"). */
export function fixMojibake(s: string): string {
  if (!/[Â-ô]/.test(s)) return s;
  const fixed = s.replace(MOJIBAKE, (m) => {
    const bytes = Uint8Array.from([...m].map((ch) => CP1252[ch.codePointAt(0)!] ?? ch.codePointAt(0)!));
    try {
      return strictUtf8.decode(bytes);
    } catch {
      return m;
    }
  });
  // A closing curly quote loses its last byte (0x9D has no cp1252 character).
  return fixed.replace(/â€(?![\u0080-¿])/g, "”");
}

/**
 * Text as a browser shows it, one line per paragraph. Line breaks in the source are
 * spaces, as in HTML (many posts were pasted from Word and wrap mid-sentence);
 * only tags break lines. softBreaks: treat <br> as a space too, for sources that
 * hard-wrap their paragraphs with it.
 */
export function htmlToLines(html: string, softBreaks = false): string[] {
  const text = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, body: string) => body.replace(/\r?\n/g, "<br>"))
      .replace(/\s+/g, " ")
      .replace(/<br\b[^>]*>/gi, softBreaks ? " " : BR)
      .replace(BLOCK_TAG, "\n")
      .replace(/<[^>]+>/g, " "),
  );
  return joinHardWraps(fixMojibake(text)
    .replace(/[ \t ​﻿]+/g, " ")
    .replace(/ +([,.;!?])/g, "$1")
    .split("\n"))
    .map((l) => l.trim())
    .filter(Boolean)
    // A list of links separated only by spaces is still a list.
    .flatMap((l) => (/^https?:\/\/\S+(\s+https?:\/\/\S+)+$/.test(l) ? l.split(/\s+/) : [l]));
}

// Where a browser starts a new line. <br> is marked with BR first, see joinHardWraps.
const BLOCK_TAG =
  /<\/?(p|div|h[1-6]|li|ul|ol|dl|dt|dd|table|thead|tbody|tr|td|th|blockquote|figure|figcaption|section|article|header|footer|aside|nav|pre|address)\b[^>]*>|<hr\b[^>]*>/gi;
const BR = "\u2028";
const SENTENCE_END = /[.!?:;…]["”’)\]]*$/;
const LIST_ITEM = /^(\d{1,2}[.):]|[-–•*·>]|\p{Extended_Pictographic})/u;
// Lines that stand alone even in a hard-wrapped post: headings, "Sumber : X", links, separators.
const OWN_LINE = /^(\p{Lu}[\p{Lu}\d &/.,()-]{1,40}|\p{Lu}[\p{L} ./&-]{1,40}\s*:.*|https?:\/\/\S+|\[[^\]]{2,40}\].*|([=\-_*~#]\s*){3,}.*)$/u;

/** Whether two <br>-separated pieces are one sentence wrapped in two. */
function continues(prev: string, next: string): boolean {
  if (SENTENCE_END.test(prev) || LIST_ITEM.test(next) || OWN_LINE.test(prev) || OWN_LINE.test(next)) return false;
  if (isHeading(prev) || isHeading(next)) return false;
  // Short pieces on both sides are a list or a byline ("April 5, 2019", "Muhammad Khairil"), not prose.
  return prev.length >= 40 || next.length >= 50;
}

/**
 * Posts pasted from e-mail or Word end every line with <br>, about every 70
 * characters. When most of a post's <br> lines look like that, a <br> inside a
 * sentence is a space; one after a full stop, or around a heading, link or list item, stays.
 */
function joinHardWraps(lines: string[]): string[] {
  const split = lines.map((l) => l.split(BR).map((s) => s.trim()).filter(Boolean));
  const broken = split.flatMap((segments) => segments.slice(0, -1));
  const wrapped = broken.filter((s) => s.length >= 50 && s.length <= 100 && !SENTENCE_END.test(s)).length;
  const hardWrapped = wrapped >= 4 && wrapped >= broken.length * 0.4;
  return split.flatMap((segments) => {
    if (!hardWrapped) return segments;
    const out: string[] = [];
    for (const s of segments) {
      const prev = out.at(-1);
      if (prev !== undefined && continues(prev, s)) out[out.length - 1] = `${prev} ${s}`;
      else out.push(s);
    }
    return out;
  });
}

export function cleanTitle(raw: string): string {
  return fixMojibake(decodeEntities(raw.replace(/<[^>]+>/g, " ")))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+[–—-]\s+(Cek Fakta|Hoax-Slayer|Hoax Buster(\s*\|\s*Covid19\.go\.id)?)\s*$/i, "")
    .replace(/\s+Summary:\s*$/i, "")
    .replace(/\s*[;:]\s*$/, "")
    .trim();
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** True when a line is the title again (possibly truncated, or without its label prefix). */
function isTitleLine(line: string, title: string): boolean {
  const a = norm(line);
  if (a.length < 8) return false;
  const full = norm(title);
  const bare = norm(stripLabelPrefix(title));
  return a === full || a === bare || (a.length >= 14 && (full.startsWith(a) || bare.startsWith(a)));
}

function excerpt(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…").trim();
}

/* ----------------------------------------------------------------- dates */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, januari: 1, februari: 2, maret: 3, mei: 5, juni: 6,
  juli: 7, agustus: 8, agu: 8, agt: 8, oktober: 10, okt: 10, desember: 12, des: 12, nopember: 11, nop: 11,
};

function iso(y: number, m: number, d: number): string {
  if (!(y >= 1995 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The WordPress copy was made in April 2019, so any later date in a post is noise. */
const WP_CUTOFF = "2019-04-30";

/**
 * Dates as the detector panel stored them, words and numbers often run together:
 * "Februari18,2022", "Selasa,21Mei201916:12WIB", "31Jul2021", "Tanggalpublish:13/12/2021",
 * "DiscoveredOn: 08Mar2006", "2019-03-04T10:00:00+07:00".
 */
export function parseLooseDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.replace(/\s+/g, " ").trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{1,2}) ?([A-Za-z]{3,9})\.? ?(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = s.match(/([A-Za-z]{3,9})\.? ?(\d{1,2}), ?(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  return "";
}

/** Finds a date anywhere in a short line: "October 4, 2015", "28 Maret 2019", "06 12-2018", "27/02/2019". */
export function parseDate(line: string): string {
  let m = line.match(/\b([A-Za-z]{3,9})\.? (\d{1,2}), ?(\d{4})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  m = line.match(/\b(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = line.match(/^(\d{2}) (\d{2})-(\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return "";
}

function dateFromUrl(url: string): string {
  const m = url.match(/\/((?:19|20)\d\d)\/(\d{1,2})\/(\d{1,2})\//);
  return m ? iso(+m[1], +m[2], +m[3]) : "";
}

/* ---------------------------------------------------------------- labels */

const LABEL_WORDS: [RegExp, LabelClass][] = [
  [/\b(HOAKS|HOAX|SALAH|FALSE|FITNAH|HASUT|PALSU|SCAM)\b/, "hoax"],
  [/\b(DISINFORMASI|MISINFORMASI|DISINFORMATION|MISINFORMATION|FRAMING|CAMPURAN|LOGICAL FALLACY)\b/, "misleading"],
  [/\b(KLARIFIKASI|CLARIFICATION)\b/, "clarification"],
  [/\b(BENAR|TRUE)\b/, "true"],
  [/\b(WASPADA)\b/, "alert"],
  [/\b(EDUKASI|EDUCATION)\b/, "education"],
  [/\b(BERITA|INFORMASI|INFO|NEWS)\b/, "news"],
];

/** "FAKTA ATAU HOAKS" and "CEK FAKTA" name a column, not a verdict. */
const NEUTRAL_LABEL = /FAKTA ATAU HOA(KS|X)|CEK FAKTA/;

function classify(label: string): LabelClass | null {
  const up = label.toUpperCase();
  if (NEUTRAL_LABEL.test(up)) return null;
  for (const [re, cls] of LABEL_WORDS) if (re.test(up)) return cls;
  return null;
}

const PREFIX = /^\s*[\[(]\s*([^\])]{2,60}?)\s*[\])]\s*:?\s*/;
const COLON_PREFIX = /^\s*([A-Z][A-Z +,&/]{2,40}?)\s*:\s+/;

const VIDEO_PREFIX = /^\s*video\s*:\s*/i;

function labelPrefix(title: string): string {
  const t = title.replace(VIDEO_PREFIX, "");
  return (t.match(PREFIX) ?? t.match(COLON_PREFIX))?.[1] ?? "";
}

/**
 * Verdicts that some publishers put in the headline instead of a label, e.g.
 * Liputan6: "[Cek Fakta] Hoaks Bakso Tikus…", "… Adalah Hoaks", "… Tak Terkait Pilpres".
 * Headlines that only ask ("…, Benarkah?") are left alone.
 */
function headlineVerdict(title: string): LabelClass | null {
  const t = stripLabelPrefix(title).trim();
  if (/^hoa(ks|x)\b/i.test(t) || /\badalah (hoa(ks|x)|salah)\s*$/i.test(t) || /\bhasil suntingan\s*$/i.test(t) || /\bbantah(an)?\b/i.test(t)) return "hoax";
  if (/\btak terkait\b/i.test(t)) return "misleading";
  return null;
}

/** "VIDEO: [CEK FAKTA] Hoaks X" becomes "Hoaks X". */
function stripLabelPrefix(title: string): string {
  let t = title;
  for (let prev = ""; t !== prev; ) {
    prev = t;
    t = t.replace(PREFIX, "").replace(COLON_PREFIX, "");
  }
  return t;
}

const IMAGE_LABEL: Record<number, { label: string; cls: LabelClass }> = {
  // Labels use the detector dataset's class names.
  6890: { label: "HOAX", cls: "hoax" },
  6900: { label: "DISINFORMATION", cls: "misleading" },
  7458: { label: "DISINFORMATION", cls: "misleading" },
  6898: { label: "FACT", cls: "true" },
  6902: { label: "INFORMATION", cls: "clarification" },
};

const CLASS_RESULT: Record<LabelClass, { verdict: Verdict; category: string }> = {
  hoax: { verdict: "hoax", category: "Hoax" },
  misleading: { verdict: "misleading", category: "Disinformation" },
  true: { verdict: "valid", category: "Verified" },
  clarification: { verdict: "valid", category: "Clarification" },
  news: { verdict: "valid", category: "News" },
  education: { verdict: "valid", category: "Education" },
  alert: { verdict: "valid", category: "Alert" },
};

/* -------------------------------------------------------------- sections */

type Section = "preamble" | "source" | "narration" | "explanation" | "reference" | "category";

/** [label pattern, section, needs a colon]. Labels that are ordinary words only count with a colon. */
type HeadingRule = [RegExp, Section, boolean];

// Spellings as they occur in the archive, typos included.
const HEADINGS: HeadingRule[] = [
  [/^(sumber|source)$/i, "source", false],
  [/^sumber (hoax|hoaks|hasut|isu|fitnah)$/i, "source", true],
  [/^(narasi|narration|narasi yang beredar|narasi dalam gambar|narasi lanjutan|informasi yang beredar|berikut narasi lengkapnya)$/i, "narration", false],
  [/^(klaim|hoax|hoaks|hasut|fitnah|isu|disinformasi)$/i, "narration", true],
  [/^(penjelasan|penejelasan|penjelasan lengkap|penjelasan & fakta|keterangan|kesimpulan|pemeriksaa?an fakta|hasil periksa fakta|hasil cek fakta|penelusuran fakta|penelusuran kompas\.com|isi klarifikasi( lengkap)?|konfirmasi|penjelasan (badan pom|bpom) ri)$/i, "explanation", false],
  [/^(fakta|faktanya|klarifikasi|explanation|investigasi|ringkasan)$/i, "explanation", true],
  [/^(referensi|refrensi|rujukan|link counter?|counter|link fafhh|tautan pendukung)$/i, "reference", false],
  [/^(reference|references|sumber (fakta|diskusi|lain))$/i, "reference", true],
  [/^(kategori|kategori hoaks|category|ketegori|kategroi|katgeori|ketogri)$/i, "category", false],
];

const HOAX_SLAYER_HEADINGS: HeadingRule[] = [
  [/^(outline|examples?|transcript)$/i, "narration", false],
  [/^an? (example|screenshot|transcript) of [a-z ]{3,40}$/i, "narration", true],
  [/^(brief analysis|detailed analysis|analysis|status|commentary|explanation)$/i, "explanation", false],
  [/^(references?|further reading)$/i, "reference", false],
];

function headingOf(line: string, headings: HeadingRule[]): { section: Section; rest: string } | null {
  const m = line.match(/^([A-Za-z][A-Za-z.&/ ]{2,50}?)\s*(:\s*(.*))?$/);
  if (!m) return null;
  const label = m[1].trim();
  for (const [re, section, needsColon] of headings) {
    if (re.test(label) && (m[2] !== undefined || !needsColon)) return { section, rest: (m[3] ?? "").trim() };
  }
  return null;
}

function isHeading(line: string): boolean {
  return !!(headingOf(line, HEADINGS) ?? headingOf(line, HOAX_SLAYER_HEADINGS));
}

// "[NARASI]:" is the same heading as "NARASI:".
const BRACKET_HEADING = /^\[([A-Za-z][A-Za-z.&/ ]{2,50}?)\]\s*(?=:|$)/;

function splitSections(lines: string[], headings = HEADINGS): Record<Section, string[]> {
  const out: Record<Section, string[]> = { preamble: [], source: [], narration: [], explanation: [], reference: [], category: [] };
  let current: Section = "preamble";
  for (const raw of lines) {
    const line = raw.replace(BRACKET_HEADING, "$1");
    const h = headingOf(line, headings);
    if (h) {
      // "Kesimpulan" continues the explanation under its own sub-heading.
      if (/^kesimpulan/i.test(line) && out.explanation.length) out.explanation.push("Kesimpulan:");
      current = h.section;
      if (h.rest) out[current].push(h.rest);
    } else {
      out[current].push(raw);
      // A category is one line; whatever follows belongs to the article again.
      if (current === "category") current = out.explanation.length ? "explanation" : "preamble";
    }
  }
  return out;
}

/* ------------------------------------------------------------------ main */

const JUNK: RegExp[] = [
  /^-->$/,
  /^`$/,
  /^(?:[=\-_*~#]\s*){3,}$/,
  /^Please enable JavaScript to view the comments/i,
  /^Selengkapnya$/i,
  /^Selengkapnya (di|pada|ada di|terdapat di|dapat dilihat di|bisa dilihat di) (bagian )?(penjelasan|referensi)\b.*$/i,
  /^(Share|Tweet|Send|Bagikan|Reddit|WhatsApp|Email|Advertisement)$/i,
  /^Baca (juga|selengkapnya)\b/i,
  /^Share [\d.,]+[km]?$/i,
  /^[\d.,]+[km]? Shares$/i,
  /^Selengkapnya,? baca:?$/i,
  /^The post .* appeared first on /i,
  /^\d+ media telah memverifikasi klaim ini$/i,
  /^\d+ dari \d+ halaman$/i,
];

const NEWS_SITES = /(^|\.)(tribunnews\.com|detik\.com|bola\.com)$/;

const SITE_LANG: Record<string, "id" | "en"> = {
  "turnbackhoax.id": "id", "stophoax.id": "id", "kominfo.go.id": "id", "cekfakta.com": "id",
  "cekfakta.tempo.co": "id", "kompas.com": "id", "liputan6.com": "id", "tribunnews.com": "id",
  "detik.com": "id", "bola.com": "id", "covid19.go.id": "id", "saberhoaks.jabarprov.go.id": "id",
  "hoax-slayer.com": "en", "truthorfiction.com": "en", "sophos.com": "en",
};

function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Groups sub-domains so "nasional.kompas.com" and "regional.kompas.com" are one source. */
export function sourceGroup(host: string): string {
  const m = host.match(/(?:^|\.)((?:kompas|detik|liputan6|tribunnews|hoax-slayer)\.(?:com|net))$/);
  if (m) return m[1] === "hoax-slayer.net" ? "hoax-slayer.com" : m[1];
  if (host === "jabarsaberhoaks.jabarprov.go.id") return "saberhoaks.jabarprov.go.id";
  return host;
}

function cutAt(lines: string[], marker: RegExp): string[] {
  const i = lines.findIndex((l) => marker.test(l));
  return i >= 0 ? lines.slice(0, i) : lines;
}

export function cleanPost(post: LegacyPost): CleanArticle {
  const title = cleanTitle(post.title.rendered);

  // The scraper appended "Original Source : <url>" to every post, not always on its own line.
  let html = post.content.rendered;
  let originalUrl = "";
  const srcIdx = html.lastIndexOf("Original Source");
  if (srcIdx >= 0) {
    const url = html.slice(srcIdx).match(/https?:\/\/[^\s<"]+/)?.[0] ?? "";
    originalUrl = decodeEntities(url).replace(/[.,]$/, "");
    html = html.slice(0, srcIdx);
  }
  const host = siteOf(originalUrl);
  const site = sourceGroup(host);
  let lines = htmlToLines(html, site === "sophos.com");

  let date = dateFromUrl(originalUrl);
  let siteClass: LabelClass | null = null;
  let sections: Record<Section, string[]> | null = null;
  let lede = "";

  lines = lines.filter((l) => !JUNK.some((re) => re.test(l)));
  const dropTitle = () => {
    while (lines.length && isTitleLine(lines[0], title)) lines.shift();
  };

  if (site === "turnbackhoax.id") {
    // title, "October 4, 2015", author, "Fitnah / Hasut / Hoax", comment count
    dropTitle();
    if (lines.length && parseDate(lines[0]) && lines[0].length < 30) {
      date ||= parseDate(lines[0]);
      lines.shift();
      const count = lines.slice(0, 4).findIndex((l) => /^\d+$/.test(l));
      if (count >= 0) lines = lines.slice(count + 1);
    }
  } else if (site === "stophoax.id") {
    // title, "By Kemkominfo", "Dec 07, 2018", tags, title again
    dropTitle();
    if (/^By /i.test(lines[0] ?? "")) lines.shift();
    if (lines.length && parseDate(lines[0]) && lines[0].length < 30) {
      date ||= parseDate(lines[0]);
      lines.shift();
      const tags = lines[0] ?? "";
      if (tags.length < 120 && !/[.!?]$/.test(tags) && tags.split(", ").every((t) => /^[A-Za-z0-9 .&-]{2,30}$/.test(t))) {
        siteClass = classify(tags);
        lines.shift();
      }
    }
    dropTitle();
  } else if (site === "kominfo.go.id") {
    // "Hoaks", short title, "06 12-2018", views, title, "Kategori Hoaks | mth", ... "Berita Terkait"
    lines = cutAt(lines, /^Berita Terkait$/i);
    if (/^(Hoaks|Berita|Siaran Pers)/i.test(lines[0] ?? "") && (lines[0] ?? "").length < 40) lines.shift();
    dropTitle();
    if (lines.length && parseDate(lines[0]) && lines[0].length < 20) {
      date ||= parseDate(lines[0]);
      lines.shift();
      if (/^\d+$/.test(lines[0] ?? "")) lines.shift();
    }
    dropTitle();
    if (/^Kategori .*\|/i.test(lines[0] ?? "")) lines.shift();
    dropTitle();
    if (/^(Hoaks|Disinformasi|Hoaks\/Disinformasi|Misinformasi)$/i.test(lines[0] ?? "")) lines.shift();
  } else if (site === "cekfakta.com") {
    // title, "Sumber:", source, "Tanggal publish: 27/02/2019", rating, "Berita", claim, "Hasil Cek Fakta", text, "Rujukan", links
    dropTitle();
    const at = (re: RegExp) => lines.findIndex((l) => re.test(l));
    const iDate = at(/^Tanggal publish/i);
    const iClaim = at(/^Berita$/);
    const iFacts = at(/^Hasil Cek Fakta$/i);
    const iRefs = at(/^Rujukan$/i);
    if (iDate >= 0) {
      date ||= parseDate(lines[iDate]);
      const rating = lines[iDate + 1] ?? "";
      if (/^Benar/i.test(rating)) siteClass = "true";
      else if (/^Klarifikasi/i.test(rating)) siteClass = "clarification";
      else if (/^Salah \[(Misleading Content|False Context|False Connection|Satire)/i.test(rating)) siteClass = "misleading";
      else if (/^Salah/i.test(rating)) siteClass = "hoax";
    }
    if (iFacts >= 0) {
      const iSrc = at(/^Sumber:?$/i);
      sections = {
        preamble: [],
        source: iSrc >= 0 && iDate > iSrc ? lines.slice(iSrc + 1, iDate) : [],
        narration: iClaim >= 0 && iClaim < iFacts ? lines.slice(iClaim + 1, iFacts) : [],
        explanation: lines.slice(iFacts + 1, iRefs > iFacts ? iRefs : undefined),
        reference: iRefs > iFacts ? lines.slice(iRefs + 1) : [],
        category: [],
      };
    }
  } else if (site === "cekfakta.tempo.co") {
    lines = cutAt(lines, /^(Cekfakta Lainnya|Metodologi)$/i);
    dropTitle();
    if (lines.length && /WIB$/.test(lines[0])) {
      date ||= parseDate(lines[0]);
      lines.shift();
    }
  } else if (site === "kompas.com") {
    lines = cutAt(lines, /^(Penulis |Editor |HOAKS ATAU FAKTA\?|Jika Anda mengetahui ada berita viral|Laporkan Hoaks|Cek Fakta Lain|Tag:|Berita Terkait|Terkini Lainnya|Terpopuler|Now Trending|Load More|Close Ads X)/i);
    const banner = (lines[0] ?? "").toLowerCase();
    if (/^(hoaks|klarifikasi|fakta)!$/.test(banner)) {
      siteClass = banner.startsWith("hoaks") ? "hoax" : banner.startsWith("klarifikasi") ? "clarification" : "true";
      lines.shift();
    }
  } else if (site === "hoax-slayer.com") {
    const stamp = lines.find((l) => /^(First published|Last updated):/i.test(l));
    if (stamp) date ||= parseDate(stamp);
    lines = cutAt(lines, /^(Last updated:|First published:|About Hoax-Slayer$|By Brett M\. Christensen$|Malware Threat Articles|Survey Scam List|Facebook Survey Scams|Facebook Scam List)/i);
    // The site rates a story either with a one-word line or in its "Brief Analysis".
    const iRating = lines.findIndex((l) => /^(False|True|Hoax|Scam|Misleading|Mixed|Unproven)$/i.test(l));
    const brief = lines.findIndex((l) => /^(Brief Analysis|Status):?/i.test(l));
    if (iRating >= 0) {
      const rating = lines[iRating].toLowerCase();
      siteClass = /false|hoax|scam/.test(rating) ? "hoax" : rating === "true" ? "true" : "misleading";
      lines.splice(iRating, 1);
    } else if (brief >= 0) {
      const verdictLine = (lines[brief].replace(/^(Brief Analysis|Status):?\s*/i, "") || lines[brief + 1] || "").toLowerCase();
      const positive = /\b(genuine|true|real|valid|legitimate|correct|accurate|indeed)\b/.test(verdictLine);
      const negative = /\b(false|hoax|fake|scam|untrue|bogus|nonsense|not true|no basis|no truth|fraud|phishing|malware|not genuine|not real)\b/.test(verdictLine);
      siteClass = positive && negative ? "misleading" : negative ? "hoax" : positive ? "true" : null;
    }
    sections = splitSections(lines, HOAX_SLAYER_HEADINGS);
  } else if (site === "truthorfiction.com") {
    lines = cutAt(lines, /^(Show More|Next Up|Popular Posts|Recent Posts|Made with truth)/i);
    // Related posts sit just before the cut: a title line followed by a line of category names.
    const categories = /^(Fact Checks|Viral Content|Reporting|Disinformation|Misinformation|Entertainment|Politics|Miscellaneous|Religious|Prayers)\b/;
    const isCategories = (l: string) => l.length < 140 && l.split(",").some((part) => categories.test(part.trim()));
    while (lines.length > 2 && isCategories(lines[lines.length - 1])) lines.splice(-2);
    const byline = lines.findIndex((l, i) => i < 8 && l.length < 60 && !!parseDate(l));
    if (byline >= 0) {
      date ||= parseDate(lines[byline]);
      const sub = lines[byline - 1] ?? "";
      if (!isTitleLine(sub, title) && sub.length > 40) lede = sub;
      lines = lines.slice(byline + 1);
    }
    const iClaim = lines.indexOf("Claim");
    const iRating = lines.indexOf("Rating");
    if (iClaim >= 0 && iRating > iClaim) {
      const rating = (lines[iRating + 1] ?? "").toLowerCase();
      siteClass = /^(not true|false|fiction)/.test(rating) ? "hoax" : /^(true|truth|correct)/.test(rating) ? "true" : "misleading";
      const body = lines.slice(iRating + 2);
      if (body[0] === "Reporting") body.shift();
      sections = { preamble: [], source: [], narration: lines.slice(iClaim + 1, iRating), explanation: body, reference: [], category: [] };
    }
  } else if (site === "sophos.com") {
    if (/^Description$/i.test(lines[0] ?? "")) lines.shift();
  } else if (site === "liputan6.com") {
    lines = cutAt(lines, /^(Saksikan video pilihan|Lanjutkan Membaca|Tag Terkait)/i);
    // Video pages end with their tags ("Cek Fakta", "Hoaks", topics), a reaction widget and popular stories.
    const widget = lines.findIndex((l) => /^\d+% suka$/i.test(l));
    if (widget >= 0) {
      const tagsFrom = lines.lastIndexOf("Cek Fakta", widget);
      const tags = tagsFrom >= 0 && widget - tagsFrom <= 8 ? lines.slice(tagsFrom, widget) : [];
      if (/\/cek-fakta\//.test(originalUrl) && tags.some((t) => /^hoa(ks|x)$/i.test(t))) siteClass = "hoax";
      lines = lines.slice(0, tags.length ? tagsFrom : widget);
    }
    if (/^Home$/i.test(lines[0] ?? "")) lines = lines.slice(2);
    dropTitle();
    const stamp = lines.findIndex((l, i) => i < 3 && /WIB$/.test(l));
    if (stamp >= 0) {
      date ||= parseDate(lines[stamp]);
      lines = lines.slice(stamp + 1);
      if (/^[\d.,]+k?$/i.test(lines[0] ?? "")) lines.shift();
    }
    // The teaser is repeated as the first paragraph, after the "Liputan6.com, Jakarta" dateline.
    const dateline = lines.findIndex((l) => /^Liputan6\.com, [A-Z]/.test(l));
    const teaser = dateline > 0 ? norm(lines[dateline - 1]).slice(0, 80) : "";
    if (teaser.length >= 40 && norm(lines[dateline]).includes(teaser)) lines.splice(dateline - 1, 1);
  } else {
    dropTitle();
  }

  sections ??= splitSections(lines);
  const join = (xs: string[]) => xs.join("\n").trim();
  const preamble = join(sections.preamble);
  let explanation = join(sections.explanation);
  let narration = join(sections.narration);
  let source = join(sections.source);
  let reference = join(sections.reference);
  // A "claim" heading only counts when the post also marks where the answer starts;
  // otherwise everything after it is simply the article. Hoax-Slayer's example blocks are reliable.
  if (narration && !explanation && site !== "hoax-slayer.com") {
    explanation = narration;
    narration = "";
  }
  // Text before the first heading is the post's own summary; it opens the explanation.
  if (!explanation) explanation = preamble;
  else if (preamble && !norm(explanation).startsWith(norm(preamble).slice(0, 80))) explanation = `${preamble}\n${explanation}`;
  if (preamble && preamble.length <= 400) lede ||= preamble;
  // A post whose only heading is "Sumber:" keeps its whole text under it.
  if (!explanation && sections.source.length > 2) {
    source = sections.source[0];
    explanation = join(sections.source.slice(1));
  }
  // Never leave a claim standing without the text that answers it.
  if (!explanation && narration) {
    explanation = narration;
    narration = "";
  }
  if (!explanation && reference.length > 200) {
    explanation = reference;
    reference = "";
  }

  // Verdict: a label in the title wins, then the dataset's cover image, then the site's own rating.
  const image = IMAGE_LABEL[post.featured_media];
  const cls = classify(labelPrefix(title)) ?? image?.cls ?? siteClass ?? headlineVerdict(title);

  const isNews =
    NEWS_SITES.test(host) ||
    (site === "liputan6.com" && !/\/cek-fakta\//.test(originalUrl)) ||
    (site === "kominfo.go.id" && !/laporan_isu_hoaks/.test(originalUrl));
  const kind = isNews && !image && !classify(labelPrefix(title)) ? "news" : "factcheck";
  const result = cls ? CLASS_RESULT[cls] : null;

  // The publisher's language is more reliable than the text, which often quotes the other language.
  const byCategory = post.categories.includes(1) ? "en" : post.categories.includes(2) ? "id" : null;
  const lang = SITE_LANG[site] ?? byCategory ?? detectLanguage(`${title}\n${explanation}`).lang;

  if (date > WP_CUTOFF) date = "";

  return {
    legacyId: post.id,
    datasetId: null,
    title,
    lang,
    kind,
    label: image?.label ?? "",
    verdict: kind === "news" ? "valid" : (result?.verdict ?? null),
    category: kind === "news" ? "News" : (result?.category ?? "Unrated"),
    date,
    sourceSite: site,
    originalUrl,
    source,
    narration,
    explanation,
    reference,
    summary: excerpt(lede || explanation || narration),
  };
}

/* ------------------------------------------------------ detector dataset */

/** One row of the legacy detector's labeled dataset (the admin panel's grid export). */
export interface DatasetRow {
  id: string;
  text_category: string | null;
  title: string;
  author: string | null;
  publish_date: string | null;
  text: string | null;
  url: string;
  website: string | null;
}

/** Verdict and category for a label from the detector's training data, or null for "UNKNOWN". */
export function datasetResult(label: string | null, title: string): { verdict: Verdict; category: string } | null {
  switch ((label ?? "").toUpperCase()) {
    case "HOAX":
      return CLASS_RESULT.hoax;
    case "DISINFORMATION":
      return CLASS_RESULT.misleading;
    case "FACT":
      return CLASS_RESULT.true;
    case "EDUKASI":
      return CLASS_RESULT.education;
    case "KLARIFIKASI":
      return CLASS_RESULT.clarification;
    case "INFORMATION": {
      // The panel folds clarifications, news and education into one class; the title says which.
      const cls = classify(labelPrefix(title));
      if (cls === "clarification" || cls === "news" || cls === "education") return CLASS_RESULT[cls];
      return { verdict: "valid", category: "Information" };
    }
    default:
      return null;
  }
}

// Section names the panel's scraper kept inline, in capitals.
const INLINE_HEADING =
  /\s*\b(KATEGORI|SUMBER|NARASI(?: DALAM GAMBAR| LANJUTAN)?|PENJELASAN|REFERENSI|HASIL PERIKSA FAKTA|KESIMPULAN)\s?:\s*/g;

/** Splits one over-long paragraph into chunks of a few sentences. */
function reflow(line: string): string[] {
  if (line.length <= 700) return [line];
  const out: string[] = [];
  let current = "";
  for (const sentence of line.split(/(?<=[.!?]["”’)]?)\s+(?=[A-Z“"(])/)) {
    if (current && current.length + sentence.length > 480) {
      out.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) out.push(current);
  return out;
}

/** The dataset stores each article as one line; this restores sections and paragraphs. */
function datasetLines(raw: string): string[] {
  const text = fixMojibake(decodeEntities(raw))
    .replace(/[ ​﻿]/g, " ")
    .replace(/\s*The post\b[\s\S]{0,300}?appeared first on\b[\s\S]{0,80}$/i, "")
    .replace(/\s*Penulis\s*:[^:]{0,80}(Editor\s*:[^:]{0,80})?$/i, "")
    .replace(/#\w+/g, " ")
    .replace(/^\s*\[(DISINFORMASI|MISINFORMASI|HOAKS|HOAX|SALAH|FAKTA|BENAR)\]\s*/i, "")
    .replace(/\[(PENJELASAN|SUMBER KLARIFIKASI|SUMBER|NARASI|FAKTA)\]/g, (_, h: string) =>
      `\n${h === "SUMBER KLARIFIKASI" ? "REFERENSI" : h === "FAKTA" ? "PENJELASAN" : h}:\n`,
    )
    .replace(/\s*(?:={3,}|(?:=\s+){3,}=?)\s*/g, "\n")
    .replace(INLINE_HEADING, "\n$1: ")
    // Paragraph breaks were lost, but a sentence glued to the next one marks where they were.
    .replace(/([a-z0-9)\]][.!?]["”’]?)(?=[A-Z][a-z])/g, "$1\n")
    .replace(/(”)(?=[A-Z][a-z]{2})/g, "$1\n")
    // Link lists lost their separators too.
    .replace(/(\S)(https?:\/\/)/g, "$1\n$2");
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap(reflow);
}

const ENGLISH_EXAMPLE_SITES = new Set(["hoax-slayer.com", "sophos.com", "truthorfiction.com"]);

/** Turns a dataset row into article fields, like cleanPost does for a WordPress post. */
export function cleanDatasetRow(row: DatasetRow): CleanArticle {
  const title = cleanTitle(row.title);
  const originalUrl = (row.url ?? "").trim();
  const site = sourceGroup(siteOf(originalUrl));
  const raw = (row.text ?? "").trim();

  let narration = "";
  let explanation = "";
  let reference = "";
  let source = "";
  let lede = "";
  // Scraper leftovers such as "0" or a lone quote are not an article.
  if (raw.length >= 60) {
    const lines = datasetLines(raw);
    const sections = splitSections(lines);
    const join = (xs: string[]) => xs.join("\n").trim();
    const headed = sections.narration.length + sections.explanation.length + sections.reference.length + sections.source.length > 0;
    if (!headed && ENGLISH_EXAMPLE_SITES.has(site)) {
      // For these sites the dataset kept the hoax message itself, not the analysis.
      narration = join(lines);
    } else if (!headed) {
      explanation = join(lines);
    } else {
      narration = join(sections.narration);
      explanation = join(sections.explanation);
      reference = join(sections.reference);
      source = join(sections.source);
      const preamble = join(sections.preamble).replace(/\s*Selengkapnya\b[^.!?\n]*[.!?]?\s*$/i, "").trim();
      if (!explanation) explanation = preamble;
      else lede = preamble;
      if (!explanation && narration) {
        explanation = narration;
        narration = "";
      }
    }
  }

  const result = datasetResult(row.text_category, title);
  const lang = SITE_LANG[site] ?? detectLanguage(`${title}\n${raw}`).lang;
  return {
    legacyId: null,
    datasetId: Number(row.id),
    title,
    lang,
    kind: "factcheck",
    label: (row.text_category ?? "").toUpperCase(),
    verdict: result?.verdict ?? null,
    category: result?.category ?? "Unrated",
    date: parseLooseDate(row.publish_date) || dateFromUrl(originalUrl),
    sourceSite: site,
    originalUrl,
    source,
    narration,
    explanation,
    reference,
    summary: excerpt(lede || explanation || narration),
  };
}
