/**
 * Text similarity for the admin detection lab. Pure functions, no database,
 * safe to import from client code.
 *
 * Every algorithm compares two token sequences and returns a score in 0..1:
 * 1 for identical inputs, 0 for inputs that share nothing. Tokens are words
 * folded the way the archive's search index folds them (accents stripped,
 * lower case), with stopwords removed, so a whole article is a few hundred
 * tokens instead of thousands of characters. `tokenizeWords` caps a sequence
 * at MAX_TOKENS, so the quadratic algorithms never do more than MAX_TOKENS²
 * (160 000) cell updates per pair.
 */

export const MAX_TOKENS = 400;

export type Method = "archive" | "levenshtein" | "damerau" | "smith-waterman" | "jaccard" | "cosine";

export const METHODS: { key: Method; label: string; note: string }[] = [
  {
    key: "archive",
    label: "Archive similarity (BM25 + rare words)",
    note: "How the public detector finds matches: the rarest words of the text, weighted by how few archive entries contain them, must appear in the candidate's title and narration.",
  },
  {
    key: "levenshtein",
    label: "Levenshtein",
    note: "Fewest word insertions, deletions and substitutions that turn one text into the other, over the longer length. O(n·m) time, O(min(n, m)) memory.",
  },
  {
    key: "damerau",
    label: "Damerau–Levenshtein",
    note: "Levenshtein plus a swap of two neighbouring words as one edit (optimal string alignment variant). O(n·m) time.",
  },
  {
    key: "smith-waterman",
    label: "Smith–Waterman",
    note: "Local alignment: the best-scoring passage the two texts share (match +2, mismatch −1, gap −1), over the shorter text's best possible score. Finds a forwarded message quoted inside a long page. O(n·m) time.",
  },
  {
    key: "jaccard",
    label: "Jaccard (word sets)",
    note: "Distinct words both texts contain, over distinct words either contains. Ignores order and repetition. O(n + m) time.",
  },
  {
    key: "cosine",
    label: "Cosine (TF-IDF)",
    note: "Cosine of the angle between word-frequency vectors, with rare words weighted up (IDF computed over the candidates). O(n + m) time.",
  },
];

export function isMethod(v: unknown): v is Method {
  return METHODS.some((m) => m.key === v);
}

const EMPTY: ReadonlySet<string> = new Set();

/** Lower case with accents stripped, the form the search index and the stopword lists share. */
export function foldText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

/**
 * Word tokens in order of appearance, duplicates kept (the sequence
 * algorithms need them), single characters and stopwords dropped, capped at
 * `max` tokens.
 */
export function tokenizeWords(text: string, stopwords: ReadonlySet<string> = EMPTY, max = MAX_TOKENS): string[] {
  const out: string[] = [];
  for (const m of foldText(text).matchAll(/[\p{L}\p{N}]+/gu)) {
    const w = m[0];
    if (w.length < 2 || stopwords.has(w)) continue;
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

type Seq = readonly string[];

/**
 * Levenshtein similarity: 1 − (edit distance / longer length). Two rows of
 * the DP table are kept, so memory is O(min(n, m)); time is O(n·m).
 */
export function levenshtein(a: Seq, b: Seq): number {
  if (a.length < b.length) [a, b] = [b, a];
  const n = a.length;
  const m = b.length;
  if (!n && !m) return 1;
  if (!n || !m) return 0;
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      const cost = ai === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[m] / n;
}

/**
 * Damerau–Levenshtein similarity in the optimal string alignment (OSA)
 * form: like Levenshtein, but swapping two adjacent words costs one edit.
 * OSA never edits a substring twice, so "ca" → "abc" costs 3, not 2; for
 * ranking near-duplicates that difference does not matter. O(n·m) time,
 * three rows of memory.
 */
export function damerauLevenshtein(a: Seq, b: Seq): number {
  if (a.length < b.length) [a, b] = [b, a];
  const n = a.length;
  const m = b.length;
  if (!n && !m) return 1;
  if (!n || !m) return 0;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return 1 - prev[m] / n;
}

/**
 * Smith–Waterman local alignment: the best-scoring aligned passage anywhere
 * in the two sequences (match +2, mismatch −1, gap −1), divided by the best
 * score the shorter sequence could reach (2 × its length). A short message
 * quoted in full inside a long page scores 1. O(n·m) time, two rows of memory.
 */
export function smithWaterman(a: Seq, b: Seq, match = 2, mismatch = -1, gap = -1): number {
  const n = a.length;
  const m = b.length;
  if (!n && !m) return 1;
  if (!n || !m) return 0;
  let prev = new Array<number>(m + 1).fill(0);
  let cur = new Array<number>(m + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= n; i++) {
    cur[0] = 0;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      const diag = prev[j - 1] + (ai === b[j - 1] ? match : mismatch);
      const v = Math.max(0, diag, prev[j] + gap, cur[j - 1] + gap);
      cur[j] = v;
      if (v > best) best = v;
    }
    [prev, cur] = [cur, prev];
  }
  return Math.min(1, best / (match * Math.min(n, m)));
}

/** Jaccard index of the two word sets: |A ∩ B| / |A ∪ B|. O(n + m). */
export function jaccard(a: Seq, b: Seq): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

/** Inverse document frequency of a term; 1 for every term gives a plain term-frequency cosine. */
export type Idf = (term: string) => number;

/** IDF over a small corpus, log(1 + N / df): a word in every document still counts a little. */
export function idfFrom(docs: readonly Seq[]): Idf {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = Math.max(docs.length, 1);
  return (term) => Math.log(1 + n / (df.get(term) ?? 1));
}

function vector(seq: Seq, idf: Idf): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of seq) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [t, c] of tf) tf.set(t, c * idf(t));
  return tf;
}

/** Cosine similarity of TF-IDF vectors (term frequency × IDF). O(n + m). */
export function cosineTfidf(a: Seq, b: Seq, idf: Idf = () => 1): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const va = vector(a, idf);
  const vb = vector(b, idf);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of va) {
    na += w * w;
    const x = vb.get(t);
    if (x) dot += w * x;
  }
  for (const w of vb.values()) nb += w * w;
  return na && nb ? Math.min(1, dot / Math.sqrt(na * nb)) : 0;
}

/** Distinct words of `a` that also occur in `b`, rarest first when an IDF is given, else in order of appearance. */
export function sharedWords(a: Seq, b: Seq, limit = 8, idf?: Idf): string[] {
  const B = new Set(b);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of a) {
    if (!B.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  if (idf) out.sort((x, y) => idf(y) - idf(x));
  return out.slice(0, limit);
}

/** Scores one pair with a pairwise method. "archive" is not pairwise; the lab handles it with the search index. */
export function scorePair(method: Exclude<Method, "archive">, a: Seq, b: Seq, idf?: Idf): number {
  switch (method) {
    case "levenshtein":
      return levenshtein(a, b);
    case "damerau":
      return damerauLevenshtein(a, b);
    case "smith-waterman":
      return smithWaterman(a, b);
    case "jaccard":
      return jaccard(a, b);
    case "cosine":
      return cosineTfidf(a, b, idf);
  }
}
