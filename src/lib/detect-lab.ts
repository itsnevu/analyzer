import type { Article } from "./data";
import { getDb, hasFts } from "./db";
import { runDetection, type DetectionResult } from "./detect";
import { asSingleUrl, readPage } from "./fetch-page";
import { detectLanguage } from "./language";
import { getStopwords, isSettingLang, isSkippedDomain, type SettingLang } from "./settings";
import { idfFrom, isMethod, scorePair, sharedWords, tokenizeWords, type Idf, type Method } from "./similarity";

/**
 * Detection lab (/admin/detect): runs one text against the archive with a
 * chosen similarity algorithm and shows every stage with its timing, next to
 * the verdict the detector itself would give. Server-only.
 *
 * Nothing here is logged: lab runs are the admin trying things out, and they
 * must not show up in the research log or the search statistics.
 */

export class LabError extends Error {}

export const LAB_LIMITS = [10, 25, 50] as const;
const MAX_CHARS = 20_000;
/** Articles pulled from the search index for scoring. */
const MAX_CANDIDATES = 300;
/** Rarest words of the text that make up the search query, as in findSimilarArticles. */
const QUERY_WORDS = 20;
/** An input this short is also scored against every published title. */
const SHORT_INPUT = 12;
/** How much of a candidate is scored: its title and the opening of its narration. */
const HEAD_CHARS = 600;

export interface LabRequest {
  text: string;
  lang: "auto" | SettingLang;
  method: Method;
  limit: number;
}

export interface LabMatch {
  rank: number;
  /** 0..1 */
  score: number;
  slug: string;
  title: string;
  verdict: Article["verdict"];
  sourceSite: string;
  date: string;
  /** Words of the input found in the candidate, rarest first. */
  shared: string[];
  /** Position in the search index's own BM25 order, when the candidate came from there. */
  bm25Rank?: number;
}

export interface LabTimings {
  /** Reading the page, when the input was a link. */
  read: number;
  preprocess: number;
  candidates: number;
  scoring: number;
  detection: number;
  total: number;
}

export interface LabResult {
  method: Method;
  lang: SettingLang;
  /** True when the language was detected rather than chosen. */
  langAuto: boolean;
  langConfidence: number;
  /** Size of the stopword list that was applied and where it came from. */
  stopwords: { count: number; from: "settings" | "built-in" };
  /** Input tokens left after folding and stopword removal (capped, see similarity.ts). */
  tokens: number;
  /** Rare words the search index was asked for, with how many archive entries contain each. */
  queryWords: { term: string; docs: number }[];
  candidates: number;
  /** True when every published title was scored as well, because the input was short. */
  titlePool: boolean;
  timings: LabTimings;
  matches: LabMatch[];
  detection: DetectionResult;
  source?: { url: string; title: string };
  /** Opening of the text that was scored. */
  excerpt: string;
  chars: number;
}

/** Used only when the settings table has no stopwords for the language (fresh database, or before `npm run import:panel`). */
const FALLBACK_STOPWORDS: Record<SettingLang, string> = {
  id:
    "yang dan atau tidak untuk dengan ini itu dari pada adalah akan sudah juga karena saja kata mereka sebuah para telah dalam " +
    "bahwa oleh kami kita anda kamu saya dia ada bisa dapat harus lebih sangat hanya seperti jika kalau namun tetapi tapi serta " +
    "agar supaya ketika saat hingga sampai antara setelah sebelum tersebut yaitu yakni pun lagi masih banyak semua setiap beberapa " +
    "secara menjadi merupakan terhadap tentang bagi hal orang tahun hari di ke se",
  en:
    "the and that this with from have has had was were are been will would there their they them what which about when where " +
    "who whom your you our not but for can could should into than then also just more most some such only over very after before " +
    "being other these those its his her she him does did doing because while of to in is it on at by an as be or we if so no",
  ms:
    "yang dan atau tidak untuk dengan ini itu dari pada adalah akan sudah juga kerana sahaja kata mereka sebuah para telah dalam " +
    "bahawa oleh kami kita anda awak saya dia ada boleh dapat harus lebih sangat hanya seperti jika kalau namun tetapi tapi serta " +
    "agar supaya ketika semasa hingga sampai antara selepas sebelum tersebut iaitu pun lagi masih banyak semua setiap beberapa " +
    "secara menjadi merupakan terhadap tentang bagi hal orang tahun hari di ke",
};

function stopwordsFor(lang: SettingLang): { set: ReadonlySet<string>; from: "settings" | "built-in" } {
  const fromSettings = getStopwords(lang);
  if (fromSettings.size) return { set: fromSettings, from: "settings" };
  return { set: new Set(FALLBACK_STOPWORDS[lang].split(" ")), from: "built-in" };
}

type Row = {
  id: number;
  slug: string;
  title: string;
  verdict: Article["verdict"];
  sourceSite: string;
  date: string;
  head: string;
  explanation: string;
};

interface Candidate {
  row: Row;
  /** Tokens of title + narration head. */
  tokens: string[];
  /** Tokens of the title alone; set for short inputs, which are compared against titles as well. */
  titleTokens?: string[];
  bm25Rank?: number;
}

/** The text's rarest words, weighted by rarity in the archive, as findSimilarArticles does it. */
function rareWords(tokens: string[]): { term: string; docs: number; weight: number }[] {
  const conn = getDb();
  const distinct = [...new Set(tokens.filter((w) => w.length >= 4 && !/^\d+$/.test(w)))].slice(0, 300);
  if (!distinct.length || !hasFts()) return [];
  const { n: total } = conn.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  const vocab = conn
    .prepare(`SELECT term, doc FROM articles_vocab WHERE term IN (${distinct.map(() => "?").join(", ")})`)
    .all(...distinct) as { term: string; doc: number }[];
  return vocab
    .filter((v) => v.doc <= Math.max(total * 0.25, 3))
    .map((v) => ({ term: v.term, docs: v.doc, weight: Math.log(1 + total / v.doc) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, QUERY_WORDS);
}

const CANDIDATE_COLUMNS = `a.id, a.slug, a.title, a.verdict, a.sourceSite, a.date, substr(a.narration, 1, ${HEAD_CHARS}) AS head, a.explanation`;

function ftsCandidates(words: { term: string }[]): Row[] {
  if (words.length < 2 || !hasFts()) return [];
  return getDb()
    .prepare(
      `SELECT ${CANDIDATE_COLUMNS}
       FROM articles_fts JOIN articles a ON a.id = articles_fts.rowid
       WHERE articles_fts MATCH ? AND a.published = 1
       ORDER BY bm25(articles_fts, 6.0, 4.0, 1.0, 1.0, 1.0) LIMIT ?`,
    )
    .all(words.map((w) => `"${w.term}"`).join(" OR "), MAX_CANDIDATES) as Row[];
}

/** Every published article, title only: the pool for short inputs such as a headline. */
function titleRows(): Row[] {
  return getDb()
    .prepare("SELECT id, slug, title, verdict, sourceSite, date, '' AS head, '' AS explanation FROM articles WHERE published = 1")
    .all() as Row[];
}

/**
 * The public detector's score (findSimilarArticles): how much of the text's
 * rare-word weight the candidate's title and narration carry, plus a smaller
 * share for the whole text including the explanation.
 */
function archiveScore(words: { term: string; weight: number }[], c: Candidate, stopwords: ReadonlySet<string>): number {
  const total = words.reduce((s, w) => s + w.weight, 0);
  if (!total) return 0;
  const coverage = (tokens: Iterable<string>) => {
    const set = new Set(tokens);
    return words.filter((w) => set.has(w.term)).reduce((s, w) => s + w.weight, 0) / total;
  };
  const head = coverage(c.tokens);
  const all = c.row.explanation ? coverage([...c.tokens, ...tokenizeWords(c.row.explanation, stopwords, 4000)]) : head;
  return 0.6 * head + 0.4 * all;
}

export async function runLab(req: LabRequest): Promise<LabResult> {
  const t0 = performance.now();
  let text = req.text.trim();
  let source: LabResult["source"];
  const timings: LabTimings = { read: 0, preprocess: 0, candidates: 0, scoring: 0, detection: 0, total: 0 };

  // A pasted link: read the page, unless the owner has put its domain on the skip list.
  const link = asSingleUrl(text);
  if (link) {
    let host = "";
    try {
      host = new URL(link).hostname;
    } catch {
      throw new LabError("That is not a valid link.");
    }
    if (isSkippedDomain(host)) throw new LabError(`${host} is on the skip list (Settings → Skipped domains), so its pages are not read.`);
    const page = await readPage(link);
    text = page.text;
    source = { url: page.url, title: page.title };
    timings.read = performance.now() - t0;
  }
  if (text.length < 15) throw new LabError("Enter at least 15 characters, or one link.");
  if (text.length > MAX_CHARS) throw new LabError(`Paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.`);

  // The detector runs while the archive is scored; its time is measured on its own.
  const detectionStart = performance.now();
  const detection = runDetection(text).then((r) => {
    timings.detection = performance.now() - detectionStart;
    return r;
  });

  // Preprocess: language, stopwords, tokens.
  const t1 = performance.now();
  const detected = detectLanguage(text);
  const lang: SettingLang = req.lang === "auto" ? detected.lang : req.lang;
  const stop = stopwordsFor(lang);
  const query = tokenizeWords(text, stop.set);
  const queryHead = source ? tokenizeWords(`${source.title}\n${text.slice(0, 1000)}`, stop.set) : query;
  const words = rareWords(queryHead);
  timings.preprocess = performance.now() - t1;

  // Candidates: the search index's answer, plus every title when the input is short.
  const t2 = performance.now();
  const candidates = new Map<string, Candidate>();
  const titlePool = query.length > 0 && query.length <= SHORT_INPUT;
  ftsCandidates(words).forEach((row, i) => {
    const tokens = tokenizeWords(`${row.title}\n${row.head}`, stop.set);
    candidates.set(row.slug, { row, tokens, titleTokens: titlePool ? tokenizeWords(row.title, stop.set) : undefined, bm25Rank: i + 1 });
  });
  if (titlePool) {
    for (const row of titleRows()) {
      if (!candidates.has(row.slug)) candidates.set(row.slug, { row, tokens: tokenizeWords(row.title, stop.set) });
    }
  }
  timings.candidates = performance.now() - t2;

  // Score. A short input (a headline) is scored against the bare title as well, and the better score counts:
  // four words against a hundred-token narration would otherwise look nothing alike to an edit distance.
  const t3 = performance.now();
  const pool = [...candidates.values()];
  const idf: Idf = idfFrom([query, ...pool.map((c) => c.tokens)]);
  const pairScore = (c: Candidate) => {
    if (req.method === "archive") return archiveScore(words, c, stop.set);
    const head = scorePair(req.method, query, c.tokens, idf);
    return c.titleTokens ? Math.max(head, scorePair(req.method, query, c.titleTokens, idf)) : head;
  };
  const scored = pool.map((c) => ({ c, score: pairScore(c) }));
  scored.sort((x, y) => y.score - x.score || y.c.row.date.localeCompare(x.c.row.date) || y.c.row.id - x.c.row.id);
  const matches: LabMatch[] = scored
    .filter((s) => s.score > 0)
    .slice(0, req.limit)
    .map((s, i) => ({
      rank: i + 1,
      score: s.score,
      slug: s.c.row.slug,
      title: s.c.row.title,
      verdict: s.c.row.verdict,
      sourceSite: s.c.row.sourceSite,
      date: s.c.row.date,
      shared: sharedWords(query, s.c.tokens, 8, idf),
      bm25Rank: s.c.bm25Rank,
    }));
  timings.scoring = performance.now() - t3;

  const result = await detection;
  timings.total = performance.now() - t0;

  return {
    method: req.method,
    lang,
    langAuto: req.lang === "auto",
    langConfidence: detected.confidence,
    stopwords: { count: stop.set.size, from: stop.from },
    tokens: query.length,
    queryWords: words.map((w) => ({ term: w.term, docs: w.docs })),
    candidates: pool.length,
    titlePool,
    timings,
    matches,
    detection: result,
    source,
    excerpt: text.slice(0, 300),
    chars: text.length,
  };
}

/** Turns a request body into a lab request, or null when it is not one. */
export function parseLabRequest(body: Record<string, unknown>): LabRequest | null {
  const text = typeof body.text === "string" ? body.text : "";
  const lang = body.lang === "auto" || isSettingLang(body.lang) ? body.lang : "auto";
  const limit = (LAB_LIMITS as readonly number[]).includes(Number(body.limit)) ? Number(body.limit) : LAB_LIMITS[1];
  if (!text.trim() || !isMethod(body.method)) return null;
  return { text, lang, method: body.method, limit };
}
