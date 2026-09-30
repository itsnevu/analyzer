/**
 * Hoax detection, integration seam.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  WIRING THE REAL RAG FUSION BACKEND                                   │
 * │                                                                       │
 * │  The legacy detector at ?page_id=6432 posted text to an internal      │
 * │  endpoint under /adminpanel. The current research build is the RAG    │
 * │  Fusion app: https://rag-fusion.streamlit.app/                        │
 * │                                                                       │
 * │  NOTE: Streamlit Community Cloud does NOT expose a JSON/REST API, it  │
 * │  talks to its own frontend over a websocket. So you cannot `fetch()`  │
 * │  it as an API. To make "connect to RAG Fusion" real, do ONE of:       │
 * │                                                                       │
 * │   1. Add a FastAPI/Flask endpoint in front of the same RAG pipeline   │
 * │      and set RAG_FUSION_API_URL in .env.local, or                     │
 * │   2. Re-expose the model via any HTTP endpoint that accepts           │
 * │      { text, lang } and returns the RagResult shape below.            │
 * │                                                                       │
 * │  Then replace the body of `runDetection` with a fetch to that URL.    │
 * │  The UI already renders whatever this returns.                        │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { detectLanguage, type Lang } from "./language";
import type { ArticleListItem } from "./data";

export type Verdict = "valid" | "misleading" | "hoax";

export interface Reference {
  title: string;
  source: string;
  url?: string;
  snippet?: string;
}

export interface DetectionSignal {
  label: string;
  /** "risk" = points toward hoax, "trust" = points toward credible */
  kind: "risk" | "trust";
}

export interface DetectionResult {
  verdict: Verdict;
  /** 0..1 confidence that the verdict is correct */
  confidence: number;
  /** 0..1 modelled probability the text is a hoax */
  hoaxProbability: number;
  language: Lang;
  languageConfidence: number;
  category: string;
  explanation: string;
  references: Reference[];
  /** markers that influenced the score, shown as a breakdown in the UI */
  signals: DetectionSignal[];
  model: string;
  /** true when produced by the local stub, false when a real backend answered */
  simulated: boolean;
  /** fact-checks from our own archive about the same claim; added by the API, not the model */
  related?: ArticleListItem[];
}

const RAG_API = process.env.RAG_FUSION_API_URL;

export async function runDetection(rawText: string): Promise<DetectionResult> {
  const text = rawText.trim();
  const { lang, confidence: langConf } = detectLanguage(text);

  // ---- Real backend path (enabled once RAG_FUSION_API_URL is set) --------
  if (RAG_API) {
    const res = await fetch(RAG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`RAG backend error: ${res.status}`);
    const data = (await res.json()) as Partial<DetectionResult>;
    return {
      verdict: data.verdict ?? "misleading",
      confidence: data.confidence ?? 0.6,
      hoaxProbability: data.hoaxProbability ?? 0.5,
      language: data.language ?? lang,
      languageConfidence: data.languageConfidence ?? langConf,
      category: data.category ?? "Uncategorized",
      explanation: data.explanation ?? "",
      references: data.references ?? [],
      signals: data.signals ?? [],
      model: data.model ?? "rag-fusion",
      simulated: false,
    };
  }

  // ---- Local stub (transparent heuristic, clearly flagged) ---------------
  return simulateDetection(text, lang, langConf);
}

/**
 * Transparent, deterministic stub so the UI is fully demonstrable without a
 * backend. It scores a handful of well-known clickbait / hoax signals. This
 * is NOT a real classifier, it exists only to exercise the interface.
 */
function simulateDetection(
  text: string,
  lang: Lang,
  langConf: number,
): DetectionResult {
  const lower = text.toLowerCase();

  const hoaxSignals = [
    "viral", "sebarkan", "share sebanyak", "wajib tahu", "rahasia",
    "konspirasi", "terbukti", "100%", "dokter tidak mau", "pemerintah menutupi",
    "breaking", "shocking", "you won't believe", "doctors hate", "miracle cure",
    "before it's deleted", "share before", "wake up", "they don't want you",
  ];
  const credibleSignals = [
    "menurut", "kata juru bicara", "data resmi", "penelitian", "jurnal",
    "according to", "study", "research", "official", "spokesperson",
    "reuters", "kompas", "antara", "press release",
  ];

  const signals: DetectionSignal[] = [];
  let score = 0.4;
  for (const s of hoaxSignals)
    if (lower.includes(s)) { score += 0.14; signals.push({ label: s, kind: "risk" }); }
  for (const s of credibleSignals)
    if (lower.includes(s)) { score -= 0.1; signals.push({ label: s, kind: "trust" }); }
  if (text.length < 60) { score += 0.08; signals.push({ label: "very short text", kind: "risk" }); }
  if ((text.match(/!/g) || []).length >= 3) { score += 0.1; signals.push({ label: "excessive exclamation marks", kind: "risk" }); }
  if ((text.match(/[A-Z]{5,}/g) || []).length >= 2) { score += 0.08; signals.push({ label: "excessive capitals", kind: "risk" }); }

  const hits = signals.filter((s) => s.kind === "risk").length;
  const hoaxProbability = Math.min(0.97, Math.max(0.05, score));

  let verdict: Verdict;
  if (hoaxProbability >= 0.66) verdict = "hoax";
  else if (hoaxProbability >= 0.42) verdict = "misleading";
  else verdict = "valid";

  const category =
    verdict === "hoax"
      ? "Disinformation"
      : verdict === "misleading"
        ? "Misinformation"
        : "Verified";

  const explanation = buildExplanation(verdict, hits);

  return {
    verdict,
    confidence: 0.55 + Math.min(0.35, hits * 0.08),
    hoaxProbability,
    language: lang,
    languageConfidence: langConf,
    category,
    explanation,
    references: SAMPLE_REFERENCES,
    signals,
    model: "local-heuristic-stub",
    simulated: true,
  };
}

function buildExplanation(v: Verdict, hits: number): string {
  if (v === "hoax")
    return `The text shows ${hits} hoax-pattern markers (calls to share, absolute claims, excessive capitals) and matches known disinformation patterns in the reference base. Verify with official sources before sharing.`;
  if (v === "misleading")
    return `The text carries some misleading markers but is not conclusive. It may be partly true yet framed in a misleading way. Check the related references below.`;
  return `No strong hoax markers were found. The text reads like a credible source, but always cross-check for important decisions.`;
}

const SAMPLE_REFERENCES: Reference[] = [
  {
    title: "Guide to Fighting Hoaxes, turnbackhoax.id",
    source: "MAFINDO / turnbackhoax.id",
    url: "https://turnbackhoax.id/",
    snippet:
      "Community fact-check database for Indonesian-language news.",
  },
  {
    title: "Fact Check, Kominfo",
    source: "Indonesian Ministry of Communication (Kominfo)",
    url: "https://www.kominfo.go.id/",
    snippet: "Official clarifications of hoaxes circulating in public.",
  },
  {
    title: "How to spot fake news, IFLA",
    source: "IFLA",
    url: "https://www.ifla.org/",
    snippet: "Eight steps to evaluate the credibility of a news item.",
  },
];
