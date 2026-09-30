/**
 * Lightweight language detection (Indonesian vs English).
 *
 * The legacy site used a paid "language detection API" before running the
 * classifier. For a self-contained redesign we ship a stopword-frequency
 * heuristic that is good enough to label the input and pick the ID/EN model.
 * Swap `detectLanguage` for a real API later if you need more languages.
 */

export type Lang = "id" | "en";

const ID_MARKERS = [
  "yang", "dan", "di", "ini", "itu", "dengan", "untuk", "tidak", "dari",
  "pada", "ke", "adalah", "akan", "sudah", "juga", "karena", "atau", "saja",
  "kata", "mereka", "sebuah", "para", "telah", "dalam", "bahwa", "hoaks",
  "berita", "warga", "pemerintah",
];

const EN_MARKERS = [
  "the", "and", "is", "to", "of", "in", "that", "for", "was", "with",
  "this", "are", "but", "not", "have", "from", "they", "you", "said",
  "would", "there", "their", "which", "about", "hoax", "news", "people",
];

export function detectLanguage(text: string): { lang: Lang; confidence: number } {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return { lang: "id", confidence: 0 };

  const idSet = new Set(ID_MARKERS);
  const enSet = new Set(EN_MARKERS);
  let idHits = 0;
  let enHits = 0;
  for (const w of words) {
    if (idSet.has(w)) idHits++;
    if (enSet.has(w)) enHits++;
  }

  const total = idHits + enHits;
  if (total === 0) return { lang: "id", confidence: 0.5 };

  const lang: Lang = idHits >= enHits ? "id" : "en";
  const confidence = Math.max(idHits, enHits) / total;
  return { lang, confidence };
}

export const LANG_LABEL: Record<Lang, string> = {
  id: "Indonesian",
  en: "English",
};
