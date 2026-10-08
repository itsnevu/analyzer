/**
 * Hoax detection. Three engines, tried in this order:
 *
 *   1. an optional external model over HTTP (MODEL_API_URL), for a service
 *      trained elsewhere;
 *   2. the classifier trained on the archive (./baseline, `npm run train:baseline`),
 *      the site's own detection model;
 *   3. a keyword heuristic, only until a classifier has been trained; its results
 *      are marked `simulated` and shown as demo mode.
 *
 * External model contract (any HTTP service; set MODEL_API_URL):
 *
 *   POST <MODEL_API_URL>   Content-Type: application/json
 *   Authorization: Bearer <MODEL_API_KEY>        (only when that is set)
 *   body     { "text": string, "lang": "id" | "en" }
 *   response {
 *     "verdict": "hoax" | "misleading" | "valid",     required
 *     "hoaxProbability": 0..1,                        required
 *     "confidence"?: 0..1, "category"?: string, "explanation"?: string,
 *     "references"?: [{ "title", "source", "url"?, "snippet"? }],
 *     "signals"?: [{ "label", "kind": "risk" | "trust" }],
 *     "model"?: string, "language"?: "id" | "en"
 *   }
 *
 * The response is validated; an external model that is down, slow
 * (MODEL_TIMEOUT_MS, default 15 s) or answers out of contract never breaks the
 * page: the local engines answer instead and the result says why.
 *
 * Whenever the external model did not answer, a matching archived fact-check
 * overrides the verdict (see app/api/detect/route.ts): the archive is the most
 * reliable source the site has.
 */

import { detectLanguage, type Lang } from "./language";
import { predictBaseline, type BaselinePrediction } from "./baseline";
import type { ArticleListItem } from "./data";
import { makeSiteT, tk, type SiteVars } from "./site-lang";

export type Verdict = "valid" | "misleading" | "hoax";

/** Which engine produced a result; see the header. */
export type Engine = "external" | "baseline" | "heuristic";

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

/**
 * One sentence of an explanation the site wrote itself, as a site-language key
 * (lib/site-lang: the English text) and its values, so the result card can show
 * it in the visitor's language. Indonesian: lib/site-i18n/detector.ts.
 */
export interface ExplanationPart {
  key: string;
  vars?: SiteVars;
}

const english = makeSiteT("en");

/** The English text of an explanation, as the `explanation` field carries it. */
export function explanationText(parts: ExplanationPart[]): string {
  return parts.map((p) => english(p.key, p.vars)).join(" ");
}

/** The `explanation` and `explanationParts` fields for a list of sentences. */
export const explained = (parts: ExplanationPart[]) => ({ explanation: explanationText(parts), explanationParts: parts });

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
  /**
   * The explanation as translatable sentences when the site wrote it (local
   * engines, archive match); `explanation` is their English text. Absent for an
   * external model's own explanation, which is shown as it is.
   */
  explanationParts?: ExplanationPart[];
  references: Reference[];
  /** markers that influenced the score, shown as a breakdown in the UI */
  signals: DetectionSignal[];
  model: string;
  engine: Engine;
  /** true only for the keyword heuristic, i.e. when no classifier has been trained; shown as demo mode */
  simulated: boolean;
  /** set when an external model is configured but could not be used, so a local engine answered instead */
  fallbackReason?: string;
  /** Row in the research log, so a role given afterwards can label this check. */
  checkId?: number | null;
  /** fact-checks from our own archive about the same claim; added by the API, not the model */
  related?: ArticleListItem[];
  /** the page that was read, when the input was a link */
  source?: { url: string; title: string };
}

const VERDICTS: Verdict[] = ["hoax", "misleading", "valid"];

const clamp01 = (n: unknown, fallback: number) => {
  const x = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x > 1 && x <= 100 ? x / 100 : x)) : fallback;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const httpUrl = (v: unknown) => {
  const u = str(v, 2000);
  return /^https?:\/\//i.test(u) ? u : undefined;
};

/** Checks a model response against the contract; returns null when it is unusable. */
export function parseModelResponse(data: unknown, lang: Lang, langConf: number): DetectionResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const verdict = String(d.verdict ?? "").toLowerCase() as Verdict;
  if (!VERDICTS.includes(verdict)) return null;
  const hoaxProbability = clamp01(d.hoaxProbability, NaN);
  if (Number.isNaN(hoaxProbability)) return null;
  const references = (Array.isArray(d.references) ? d.references : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ title: str(r.title, 300), source: str(r.source, 200), url: httpUrl(r.url), snippet: str(r.snippet, 600) || undefined }))
    .filter((r) => r.title)
    .slice(0, 10);
  const signals = (Array.isArray(d.signals) ? d.signals : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ label: str(x.label, 120), kind: x.kind === "trust" ? ("trust" as const) : ("risk" as const) }))
    .filter((x) => x.label)
    .slice(0, 20);
  return {
    verdict,
    hoaxProbability,
    confidence: clamp01(d.confidence, 0.6),
    language: d.language === "en" || d.language === "id" ? d.language : lang,
    languageConfidence: clamp01(d.languageConfidence, langConf),
    category: str(d.category, 80) || (verdict === "hoax" ? "Hoax" : verdict === "misleading" ? "Misleading" : "Credible"),
    explanation: str(d.explanation, 4000),
    references,
    signals,
    model: str(d.model, 80) || "external-model",
    engine: "external",
    simulated: false,
  };
}

const modelTimeoutMs = () => Number(process.env.MODEL_TIMEOUT_MS) || 15_000;

/** The request the contract above describes; the key goes in the header only when set. */
function modelRequest(text: string, lang: Lang): RequestInit {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.MODEL_API_KEY) headers.Authorization = `Bearer ${process.env.MODEL_API_KEY}`;
  return { method: "POST", headers, body: JSON.stringify({ text, lang }), cache: "no-store", signal: AbortSignal.timeout(modelTimeoutMs()) };
}

async function askModel(url: string, text: string, lang: Lang, langConf: number): Promise<DetectionResult> {
  const res = await fetch(url, modelRequest(text, lang));
  if (!res.ok) throw new Error(`the model answered HTTP ${res.status}`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("the model did not answer with JSON");
  }
  const parsed = parseModelResponse(data, lang, langConf);
  if (!parsed) throw new Error("the model's answer did not match the expected format");
  return parsed;
}

export interface PingResult {
  /** the URL answered at all (any HTTP status) */
  reachable: boolean;
  status: number | null;
  latencyMs: number | null;
  /** the answer was JSON that follows the contract */
  contract: boolean;
  model?: string;
  verdict?: Verdict;
  hoaxProbability?: number;
  error?: string;
}

const PING_TEXT = "Pesan berantai: vaksin mengandung chip yang bisa melacak lokasi kita. Sebarkan ke semua grup sebelum dihapus!";

/**
 * Sends a short sample to the configured external model and reports what came
 * back, for the admin Model page. Never throws and never exposes the key.
 */
export async function pingModel(text = PING_TEXT): Promise<PingResult> {
  const url = process.env.MODEL_API_URL;
  if (!url) return { reachable: false, status: null, latencyMs: null, contract: false, error: "MODEL_API_URL is not set" };
  const started = performance.now();
  const latencyMs = () => Math.round(performance.now() - started);
  let res: Response;
  try {
    res = await fetch(url, modelRequest(text, "id"));
  } catch (err) {
    const error = err instanceof Error && err.name === "TimeoutError" ? `no answer within ${modelTimeoutMs()} ms` : err instanceof Error ? err.message : "could not be reached";
    return { reachable: false, status: null, latencyMs: latencyMs(), contract: false, error };
  }
  const status = res.status;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { reachable: true, status, latencyMs: latencyMs(), contract: false, error: res.ok ? "the answer was not JSON" : `HTTP ${status}` };
  }
  const parsed = parseModelResponse(data, "id", 0.9);
  if (!parsed) return { reachable: true, status, latencyMs: latencyMs(), contract: false, error: res.ok ? "the answer did not match the contract" : `HTTP ${status}` };
  return { reachable: true, status, latencyMs: latencyMs(), contract: true, model: parsed.model, verdict: parsed.verdict, hoaxProbability: parsed.hoaxProbability };
}

export async function runDetection(rawText: string): Promise<DetectionResult> {
  const text = rawText.trim();
  const { lang, confidence: langConf } = detectLanguage(text);

  const url = process.env.MODEL_API_URL;
  if (url) {
    try {
      return await askModel(url, text, lang, langConf);
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? "the model took too long to answer" : err instanceof Error ? err.message : "the model could not be reached";
      console.error("[detect] external model unavailable, using the local engine:", reason);
      // The detail stays in the server log; visitors only learn which kind of failure it was.
      const publicReason = err instanceof Error && err.name === "TimeoutError" ? "it took too long to answer" : "it could not be used";
      return { ...localDetection(text, lang, langConf), fallbackReason: publicReason };
    }
  }

  return localDetection(text, lang, langConf);
}

/** Markers any text can show, whichever local engine answers: shouting, stacked exclamation marks, a one-liner. */
function surfaceSignals(text: string): { signals: DetectionSignal[]; score: number } {
  const signals: DetectionSignal[] = [];
  let score = 0;
  if (text.length < 60) { score += 0.08; signals.push({ label: "very short text", kind: "risk" }); }
  if ((text.match(/!/g) || []).length >= 3) { score += 0.1; signals.push({ label: "excessive exclamation marks", kind: "risk" }); }
  if ((text.match(/[A-Z]{5,}/g) || []).length >= 2) { score += 0.08; signals.push({ label: "excessive capitals", kind: "risk" }); }
  return { signals, score };
}

const categoryOf = (v: Verdict) => (v === "hoax" ? "Disinformation" : v === "misleading" ? "Misinformation" : "Verified");

/**
 * The local engines: the classifier trained on the archive when its model file
 * exists (see ./baseline), otherwise a transparent, deterministic keyword stub
 * that scores a handful of well-known clickbait / hoax signals so the UI works
 * before any model has been trained.
 */
function localDetection(
  text: string,
  lang: Lang,
  langConf: number,
): DetectionResult {
  const surface = surfaceSignals(text);
  const baseline = predictBaseline(text);
  if (baseline) return baselineDetection(baseline, surface.signals, lang, langConf);

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
  signals.push(...surface.signals);
  score += surface.score;

  const hits = signals.filter((s) => s.kind === "risk").length;
  const hoaxProbability = Math.min(0.97, Math.max(0.05, score));

  let verdict: Verdict;
  if (hoaxProbability >= 0.66) verdict = "hoax";
  else if (hoaxProbability >= 0.42) verdict = "misleading";
  else verdict = "valid";

  return {
    verdict,
    confidence: 0.55 + Math.min(0.35, hits * 0.08),
    hoaxProbability,
    language: lang,
    languageConfidence: langConf,
    category: categoryOf(verdict),
    ...explained(buildExplanation(verdict, hits)),
    references: SAMPLE_REFERENCES,
    signals,
    model: "local-heuristic-stub",
    engine: "heuristic",
    simulated: true,
  };
}

/** The opening sentence of the trained classifier's explanation, per verdict. */
const BASELINE_LEAD: Record<Verdict, string> = {
  hoax: tk("The detection model, trained on thousands of published fact-checks, read this text as a hoax (hoax {hoax}, misleading {misleading}, credible {credible})."),
  misleading: tk("The detection model, trained on thousands of published fact-checks, read this text as misleading (hoax {hoax}, misleading {misleading}, credible {credible})."),
  valid: tk("The detection model, trained on thousands of published fact-checks, read this text as credible (hoax {hoax}, misleading {misleading}, credible {credible})."),
};

/** The trained classifier's answer in the shape of a detection, with its strongest cues as signals. */
function baselineDetection(p: BaselinePrediction, surface: DetectionSignal[], lang: Lang, langConf: number): DetectionResult {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const quoted = (kind: "risk" | "trust") => p.topFeatures.filter((f) => f.kind === kind).slice(0, 4).map((f) => `“${f.token}”`);
  const risk = quoted("risk");
  const trust = quoted("trust");
  const cues: DetectionSignal[] = p.topFeatures.slice(0, 6).map((f) => ({ label: `${f.token.includes(" ") ? "phrase" : "word"}: ${f.token}`, kind: f.kind }));
  const parts: ExplanationPart[] = [
    { key: BASELINE_LEAD[p.verdict], vars: { hoax: pct(p.probabilities.hoax), misleading: pct(p.probabilities.misleading), credible: pct(p.probabilities.valid) } },
    { key: tk("It weighs the wording against claims that fact-checkers have debunked or confirmed; it does not verify facts.") },
  ];
  if (risk.length) parts.push({ key: tk("Strongest cues toward hoax: {cues}."), vars: { cues: risk.join(", ") } });
  if (trust.length) parts.push({ key: tk("Toward credible: {cues}."), vars: { cues: trust.join(", ") } });
  parts.push({ key: tk("Verify with official sources before sharing.") });
  return {
    verdict: p.verdict,
    confidence: p.confidence,
    hoaxProbability: p.hoaxProbability,
    language: lang,
    languageConfidence: langConf,
    category: categoryOf(p.verdict),
    ...explained(parts),
    references: SAMPLE_REFERENCES,
    signals: [...cues, ...surface],
    model: p.model,
    engine: "baseline",
    simulated: false,
  };
}

function buildExplanation(v: Verdict, hits: number): ExplanationPart[] {
  if (v === "hoax")
    return [{ key: tk("The text shows {n} hoax-pattern markers (calls to share, absolute claims, excessive capitals) and matches known disinformation patterns in the reference base. Verify with official sources before sharing."), vars: { n: hits } }];
  if (v === "misleading")
    return [{ key: tk("The text carries some misleading markers but is not conclusive. It may be partly true yet framed in a misleading way. Check the related references below.") }];
  return [{ key: tk("No strong hoax markers were found. The text reads like a credible source, but always cross-check for important decisions.") }];
}

/** Shown with every local-engine result; the result card shows these texts in the visitor's language. */
const SAMPLE_REFERENCES: Reference[] = [
  {
    title: tk("Guide to Fighting Hoaxes, turnbackhoax.id"),
    source: "MAFINDO / turnbackhoax.id",
    url: "https://turnbackhoax.id/",
    snippet: tk("Community fact-check database for Indonesian-language news."),
  },
  {
    title: tk("Fact Check, Kominfo"),
    source: tk("Indonesian Ministry of Communication (Kominfo)"),
    url: "https://www.kominfo.go.id/",
    snippet: tk("Official clarifications of hoaxes circulating in public."),
  },
  {
    title: tk("How to spot fake news, IFLA"),
    source: "IFLA",
    url: "https://www.ifla.org/",
    snippet: tk("Eight steps to evaluate the credibility of a news item."),
  },
];
