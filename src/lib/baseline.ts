/**
 * The site's hoax classifier: multinomial logistic regression over TF-IDF
 * unigrams and bigrams, trained on the published fact-checks in the archive.
 * It answers public checks unless an external model is configured (see
 * ./detect), and is meant to be honest rather than clever.
 *
 * Training text is what a user would paste, the claim, not the debunk: the
 * title without its leading tag ("[SALAH] …", "[HOAKS] …", "(KLARIFIKASI) …")
 * plus the narration, or the summary when there is no narration. Verdict
 * words (salah, hoaks, klarifikasi, fakta, benar, false, fake, true, …) are
 * never features, so the model cannot learn the fact-checker's own label.
 *
 * Text variant: "claim" (title + narration/summary) is what ships. The
 * "claim+explanation" variant, which adds the fact-checker's explanation to
 * every training document, was tried as well; both were scored on the same
 * claim-only holdout, the condition the model runs in. On the real archive the
 * explanation variant lost about three points of macro-F1 and four of accuracy
 * (0.58 / 0.70 against 0.60 / 0.74) while making the file five times larger:
 * the debunk wording (source names, "dilansir", "menyatakan", dates) dominates
 * the weights and says little about a claim that arrives without a debunk. The
 * script can still train it (`npm run train:baseline -- --compare`).
 *
 * Features: unigrams and bigrams of folded tokens, document frequency >= 2,
 * sublinear TF-IDF, L2-normalised. Function words of both languages are left
 * out as well as the verdict words: the English side of the archive is 91%
 * hoax, so "the" and "will" would otherwise be strong hoax cues through the
 * idf alone. That costs about a point of in-domain macro-F1 and removes the
 * "English means hoax" shortcut on texts outside the archive.
 *
 * Model: one weight vector per class, trained with plain SGD (L2 shrinkage via
 * the usual scaling trick, fully balanced class weights for the 74/13/13
 * split), no intercept, near-zero weights pruned, and a softmax temperature
 * fitted on the holdout so the probabilities are not always 0.99. Without an
 * intercept a text the model knows nothing about gets a uniform answer instead
 * of inheriting the archive's hoax-heavy prior; the holdout scores are the same
 * within noise. Multinomial naive Bayes (tf-idf counts, alpha 0.1 to 1) was
 * tried too and scored 5 to 8 points lower on the same holdout, so it is not kept.
 *
 * Mind what the archive is: fact-checks, not a sample of what people read.
 * The model learns which claims fact-checkers debunked or confirmed, so a
 * topic the archive only ever debunked (COVID-19, vaccines, email scams) reads
 * as hoax-prone whatever the text says. Misleading is the weakest class
 * (F1 about 0.35): it is small and a third of its rows are title-only.
 *
 * Deployment-side notes:
 *   hoaxProbability = P(hoax) + 0.5 * P(misleading), the same 1 / 0.5 / 0 scale
 *   the archive match uses, so the gauge reads the same whichever engine answered.
 *   confidence = the winning class probability.
 *   topFeatures = the tokens that moved the hoax-versus-credible log-odds most;
 *   x_j * (w_hoax_j - w_valid_j), which is the centred projection of the
 *   (1, 0.5, 0) scale onto the three class weights (misleading cancels out).
 *
 * Server-only. Pure TypeScript, no dependencies beyond node:fs and node:sqlite.
 */

import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Verdict } from "./detect";

export const CLASSES: readonly Verdict[] = ["hoax", "misleading", "valid"];
const K = CLASSES.length;

export type TextVariant = "claim" | "claim+explanation";
export const TEXT_VARIANTS: readonly TextVariant[] = ["claim", "claim+explanation"];

export const MODEL_NAME = "baseline-lr";
const MODEL_VERSION = 1;

/** Where the model lives; data/ is git-ignored. */
export function baselineModelPath(): string {
  return process.env.BASELINE_MODEL_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "models", "baseline.json");
}

/* ---------------------------------------------------------------- text */

/**
 * The fact-checker's verdict vocabulary, in both languages. These never become
 * features: a title such as "[SALAH] Vaksin mengandung chip" would otherwise
 * teach the model that "salah" means hoax, which says nothing about a claim
 * pasted by a user.
 */
export const VERDICT_WORDS: ReadonlySet<string> = new Set([
  "salah", "hoaks", "hoax", "hoaxs", "klarifikasi", "fakta", "faktanya", "disinformasi", "misinformasi",
  "benar", "cek", "false", "fake", "true", "misleading", "satire", "satir", "fact", "untrue", "keliru", "debunked",
]);

/**
 * Function words of both languages. They carry no meaning, but in a corpus that
 * is 91% hoax on the English side they would teach the model that "the" and
 * "will" mean hoax, so they are left out. Negations ("tidak", "bukan", "not")
 * and the wording of forwarded messages ("sebarkan", "viral") are kept: they
 * are real cues.
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  (
    "yang dan atau untuk dengan ini itu dari pada adalah akan sudah juga karena saja para telah dalam bahwa oleh kami kita anda kamu " +
    "saya dia ada bisa dapat harus lebih sangat hanya seperti jika kalau namun tetapi tapi serta agar supaya ketika saat hingga sampai " +
    "antara setelah sebelum tersebut yaitu yakni pun lagi masih banyak semua setiap beberapa secara menjadi merupakan terhadap tentang " +
    "bagi hal di ke se nya ia pula kepada sebagai dengan sebab maka lalu kemudian hingga atas bawah " +
    "the and that this with from have has had was were are been will would there their they them what which about when where who whom " +
    "your you our but for can could should into than then also just more most some such only over very after before being other these " +
    "those its his her she him does did doing because while of to in on at by as is it be an or we he my me do so if up out all any each " +
    "am were been having"
  ).split(" "),
);

/** Leading "[SALAH]", "(HOAX):", "[Fakta atau Hoaks]" tags, possibly several, with their trailing colon or dash. */
const LEADING_TAG = /^\s*(?:[[(][^\])]{1,60}[\])]\s*[:\-–—]?\s*)+/u;

/** The title as a user would paste it: without the fact-checker's bracket tag. */
export function stripTag(title: string): string {
  return title.replace(LEADING_TAG, "").trim();
}

/**
 * Folded word tokens: NFKD, accents stripped, lowercase, letters and digits only,
 * at least two characters. A verdict word or function word becomes null so that
 * no bigram is formed across it.
 */
export function foldTokens(text: string): (string | null)[] {
  const folded = text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  const out: (string | null)[] = [];
  for (const m of folded.matchAll(/[\p{L}\p{N}]+/gu)) {
    const t = m[0];
    if (t.length < 2) continue;
    out.push(VERDICT_WORDS.has(t) || FUNCTION_WORDS.has(t) ? null : t);
  }
  return out;
}

/** Unigram and bigram features of a text, as counted by the model. */
export function featureTokens(text: string): string[] {
  const tokens = foldTokens(text);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    out.push(t);
    const next = tokens[i + 1];
    if (next) out.push(`${t} ${next}`);
  }
  return out;
}

interface TextRow {
  title: string;
  narration: string;
  summaryId: string;
  summaryEn: string;
  explanation: string;
}

/** The training text of an archive row for a variant (see the file header). */
export function trainingText(row: TextRow, variant: TextVariant): string {
  const claim = row.narration.trim() || row.summaryId.trim() || row.summaryEn.trim();
  const parts = [stripTag(row.title), claim];
  if (variant === "claim+explanation") parts.push(row.explanation);
  return parts.filter(Boolean).join("\n");
}

function countTokens(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of featureTokens(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

/* --------------------------------------------------------------- model */

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

/** What `trainBaseline` returns and what the model file carries besides its weights. */
export interface BaselineMetrics {
  version: number;
  model: string;
  trainedAt: string;
  textVariant: TextVariant;
  /** training documents (published archive rows minus the holdout) */
  docs: number;
  /** holdout documents the metrics were measured on */
  holdout: number;
  /** features kept after pruning */
  features: number;
  accuracy: number;
  macroF1: number;
  perClass: Record<Verdict, ClassMetrics>;
  /** rows = actual class, columns = predicted class, both in CLASSES order */
  confusion: number[][];
  temperature: number;
  /** wall-clock time of the training run, ms */
  trainMs: number;
}

export interface BaselineModel extends BaselineMetrics {
  classes: Verdict[];
  bias: number[];
  vocab: string[];
  idf: number[];
  /** flat, K weights per feature in CLASSES order */
  weights: number[];
}

/** A loaded model with its lookup table. */
interface LoadedModel {
  model: BaselineModel;
  index: Map<string, number>;
  path: string;
  mtimeMs: number;
  sizeBytes: number;
}

interface SparseVec {
  idx: Int32Array;
  val: Float64Array;
}

/** TF-IDF vector of a token count map over a vocabulary, sublinear and L2-normalised. */
function vectorize(counts: Map<string, number>, index: Map<string, number>, idf: ArrayLike<number>): SparseVec {
  const idx: number[] = [];
  const val: number[] = [];
  let norm = 0;
  for (const [tok, n] of counts) {
    const j = index.get(tok);
    if (j === undefined) continue;
    const v = (1 + Math.log(n)) * idf[j];
    idx.push(j);
    val.push(v);
    norm += v * v;
  }
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  return { idx: Int32Array.from(idx), val: Float64Array.from(val, (v) => v * scale) };
}

function logits(vec: SparseVec, weights: ArrayLike<number>, bias: ArrayLike<number>, scale = 1): number[] {
  const z = Array.from(bias);
  for (let i = 0; i < vec.idx.length; i++) {
    const base = vec.idx[i] * K;
    const x = vec.val[i];
    for (let c = 0; c < K; c++) z[c] += scale * weights[base + c] * x;
  }
  return z;
}

function softmax(z: number[], temperature = 1): number[] {
  const scaled = z.map((v) => v / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/* ------------------------------------------------------------- training */

export interface TrainOptions {
  variant?: TextVariant;
  /** share of each class kept aside for evaluation and calibration; default 0.1 */
  holdoutFraction?: number;
  seed?: number;
  epochs?: number;
  learningRate?: number;
  /** L2 strength per step */
  l2?: number;
  /** 0 = no class weights, 1 = fully balanced; default 1 */
  classWeightPower?: number;
  minDf?: number;
  /** features whose largest class weight is below this are dropped from the file */
  pruneBelow?: number;
  /** learn a per-class intercept; default false (see the file header) */
  intercept?: boolean;
  /** false evaluates only and writes nothing; default true */
  write?: boolean;
  modelPath?: string;
}

interface Doc {
  counts: Map<string, number>;
  label: number;
}

/** Deterministic PRNG (mulberry32), so a training run is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface ArticleRow extends TextRow {
  verdict: string;
}

/** Published archive rows; hidden rows are unreviewed and have no trustworthy verdict. */
function readRows(db: DatabaseSync): ArticleRow[] {
  return db
    .prepare("SELECT title, narration, summaryId, summaryEn, explanation, verdict FROM articles WHERE published = 1")
    .all() as unknown as ArticleRow[];
}

/** Stratified split: the same share of every class goes to the holdout. */
function split(docs: Doc[], fraction: number, random: () => number): { train: Doc[]; holdout: Doc[] } {
  const train: Doc[] = [];
  const holdout: Doc[] = [];
  for (let c = 0; c < K; c++) {
    const ofClass = shuffle(docs.filter((d) => d.label === c), random);
    const n = Math.round(ofClass.length * fraction);
    holdout.push(...ofClass.slice(0, n));
    train.push(...ofClass.slice(n));
  }
  return { train, holdout };
}

function evaluate(predicted: number[], actual: number[]): Pick<BaselineMetrics, "accuracy" | "macroF1" | "perClass" | "confusion"> {
  const confusion = CLASSES.map(() => CLASSES.map(() => 0));
  for (let i = 0; i < actual.length; i++) confusion[actual[i]][predicted[i]]++;
  const perClass = {} as Record<Verdict, ClassMetrics>;
  let correct = 0;
  let f1Sum = 0;
  for (let c = 0; c < K; c++) {
    const tp = confusion[c][c];
    const support = confusion[c].reduce((a, b) => a + b, 0);
    const predictedAs = confusion.reduce((a, row) => a + row[c], 0);
    const precision = predictedAs ? tp / predictedAs : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perClass[CLASSES[c]] = { precision: round(precision), recall: round(recall), f1: round(f1), support };
    correct += tp;
    f1Sum += f1;
  }
  return { accuracy: round(actual.length ? correct / actual.length : 0), macroF1: round(f1Sum / K), perClass, confusion };
}

const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

/** The temperature that minimises the holdout's negative log-likelihood. */
function calibrate(logitRows: number[][], actual: number[]): number {
  if (!actual.length) return 1;
  let best = 1;
  let bestNll = Infinity;
  for (let t = 0.3; t <= 5.0001; t += 0.05) {
    let nll = 0;
    for (let i = 0; i < actual.length; i++) nll -= Math.log(Math.max(softmax(logitRows[i], t)[actual[i]], 1e-12));
    if (nll < bestNll) {
      bestNll = nll;
      best = t;
    }
  }
  return round(best, 2);
}

/**
 * Trains the model on the live database and, unless `write` is false, writes
 * the model file. Returns the holdout metrics. Reads the articles table only.
 */
export function trainBaseline(db: DatabaseSync, opts: TrainOptions = {}): BaselineMetrics {
  const started = Date.now();
  const variant = opts.variant ?? "claim";
  const epochs = opts.epochs ?? 12;
  const lr0 = opts.learningRate ?? 1;
  const l2 = opts.l2 ?? 1e-6;
  const power = opts.classWeightPower ?? 1;
  const minDf = opts.minDf ?? 2;
  const pruneBelow = opts.pruneBelow ?? 0.02;
  const intercept = opts.intercept ?? false;
  const random = rng(opts.seed ?? 42);

  const rows = readRows(db).filter((r) => CLASSES.includes(r.verdict as Verdict));
  if (rows.length < 2 * K) throw new Error(`Not enough published articles to train on (${rows.length}).`);
  // The holdout is always the claim text, the condition the model runs in, whatever was trained on.
  const docs: Doc[] = rows.map((r) => ({ counts: countTokens(trainingText(r, "claim")), label: CLASSES.indexOf(r.verdict as Verdict) }));
  const { train: trainClaim, holdout } = split(docs, opts.holdoutFraction ?? 0.1, random);
  const train =
    variant === "claim"
      ? trainClaim
      : (() => {
          // Re-read the chosen rows with their explanation; the split is by row identity.
          const chosen = new Set(trainClaim);
          return docs.map((d, i) => (chosen.has(d) ? { counts: countTokens(trainingText(rows[i], variant)), label: d.label } : null)).filter((d): d is Doc => !!d);
        })();

  // Vocabulary and idf from the training documents only.
  const df = new Map<string, number>();
  for (const d of train) for (const tok of d.counts.keys()) df.set(tok, (df.get(tok) ?? 0) + 1);
  const vocab = [...df.entries()].filter(([, n]) => n >= minDf).map(([tok]) => tok).sort();
  const index = new Map(vocab.map((tok, j) => [tok, j]));
  const idf = Float64Array.from(vocab, (tok) => Math.log((train.length + 1) / ((df.get(tok) ?? 0) + 1)) + 1);
  const V = vocab.length;

  const vectors = train.map((d) => vectorize(d.counts, index, idf));
  const labels = train.map((d) => d.label);
  const counts = CLASSES.map((_, c) => labels.filter((l) => l === c).length);
  const classWeight = counts.map((n) => (n ? (train.length / (K * n)) ** power : 0));

  // SGD on the multinomial logistic loss. W holds the weights divided by `scale`,
  // so the L2 shrink of every weight costs one multiplication per step.
  const W = new Float64Array(V * K);
  const bias = new Array<number>(K).fill(0);
  let scale = 1;
  const order = train.map((_, i) => i);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const lr = lr0 / (1 + epoch * 0.5);
    for (const i of shuffle(order, random)) {
      const vec = vectors[i];
      const y = labels[i];
      const p = softmax(logits(vec, W, bias, scale));
      scale *= 1 - lr * l2;
      for (let c = 0; c < K; c++) {
        const g = (p[c] - (c === y ? 1 : 0)) * classWeight[y];
        if (intercept) bias[c] -= lr * g;
        const step = (lr * g) / scale;
        for (let k = 0; k < vec.idx.length; k++) W[vec.idx[k] * K + c] -= step * vec.val[k];
      }
      if (scale < 1e-6) {
        for (let j = 0; j < W.length; j++) W[j] *= scale;
        scale = 1;
      }
    }
  }

  // Prune features that carry no weight, then score the pruned model exactly as the runtime will.
  const kept: number[] = [];
  for (let j = 0; j < V; j++) {
    let max = 0;
    for (let c = 0; c < K; c++) max = Math.max(max, Math.abs(W[j * K + c] * scale));
    if (max >= pruneBelow) kept.push(j);
  }
  const model: BaselineModel = {
    version: MODEL_VERSION,
    model: MODEL_NAME,
    trainedAt: new Date().toISOString(),
    textVariant: variant,
    docs: train.length,
    holdout: holdout.length,
    features: kept.length,
    accuracy: 0,
    macroF1: 0,
    perClass: {} as Record<Verdict, ClassMetrics>,
    confusion: [],
    temperature: 1,
    trainMs: 0,
    classes: [...CLASSES],
    bias: bias.map((b) => round(b)),
    vocab: kept.map((j) => vocab[j]),
    idf: kept.map((j) => round(idf[j], 3)),
    weights: kept.flatMap((j) => CLASSES.map((_, c) => round(W[j * K + c] * scale))),
  };
  const loaded = toLoaded(model, "", 0, 0);
  const holdoutLogits = holdout.map((d) => logits(vectorize(d.counts, loaded.index, model.idf), model.weights, model.bias));
  const actual = holdout.map((d) => d.label);
  const predicted = holdoutLogits.map((z) => z.indexOf(Math.max(...z)));
  Object.assign(model, evaluate(predicted, actual));
  model.temperature = calibrate(holdoutLogits, actual);
  model.trainMs = Date.now() - started;

  if (opts.write !== false) {
    const file = opts.modelPath ?? baselineModelPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(model));
    fs.renameSync(tmp, file);
    cached = null;
  }
  return metricsOf(model);
}

function metricsOf(m: BaselineModel): BaselineMetrics {
  const { version, model, trainedAt, textVariant, docs, holdout, features, accuracy, macroF1, perClass, confusion, temperature, trainMs } = m;
  return { version, model, trainedAt, textVariant, docs, holdout, features, accuracy, macroF1, perClass, confusion, temperature, trainMs };
}

/* -------------------------------------------------------------- runtime */

let cached: LoadedModel | null = null;

function toLoaded(model: BaselineModel, file: string, mtimeMs: number, sizeBytes: number): LoadedModel {
  return { model, index: new Map(model.vocab.map((tok, j) => [tok, j])), path: file, mtimeMs, sizeBytes };
}

function isModel(data: unknown): data is BaselineModel {
  const m = data as BaselineModel;
  return (
    !!m && typeof m === "object" && m.version === MODEL_VERSION && Array.isArray(m.vocab) && Array.isArray(m.idf) && Array.isArray(m.weights) &&
    Array.isArray(m.bias) && m.bias.length === K && m.weights.length === m.vocab.length * K && m.idf.length === m.vocab.length
  );
}

/**
 * The model file, parsed once and re-read when it changes on disk (after
 * `npm run train:baseline` or "Train now" in the admin panel). Null when there
 * is no usable model file.
 */
export function loadBaseline(): LoadedModel | null {
  const file = baselineModelPath();
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    cached = null;
    return null;
  }
  if (cached && cached.path === file && cached.mtimeMs === stat.mtimeMs && cached.sizeBytes === stat.size) return cached;
  try {
    const data: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isModel(data)) throw new Error("not a baseline model file");
    cached = toLoaded(data, file, stat.mtimeMs, stat.size);
  } catch (err) {
    console.error(`[baseline] could not load ${file}:`, err);
    cached = null;
  }
  return cached;
}

export function baselineAvailable(): boolean {
  return loadBaseline() !== null;
}

export interface BaselineFeature {
  token: string;
  /** contribution to the hoax-versus-credible log-odds; positive pushes toward hoax */
  weight: number;
  kind: "risk" | "trust";
}

export interface BaselinePrediction {
  verdict: Verdict;
  probabilities: Record<Verdict, number>;
  /** P(hoax) + 0.5 * P(misleading) */
  hoaxProbability: number;
  /** the winning class probability */
  confidence: number;
  topFeatures: BaselineFeature[];
  model: string;
}

/** Classifies a text with the loaded model; null when no model is available. */
export function predictBaseline(text: string, maxFeatures = 8): BaselinePrediction | null {
  const loaded = loadBaseline();
  if (!loaded) return null;
  const { model, index } = loaded;
  const vec = vectorize(countTokens(text), index, model.idf);
  // Nothing the model knows: no verdict rather than a coin toss (the caller falls back).
  if (vec.idx.length === 0) return null;
  const p = softmax(logits(vec, model.weights, model.bias), model.temperature);
  const winner = p.indexOf(Math.max(...p));
  const probabilities = Object.fromEntries(CLASSES.map((c, i) => [c, round(p[i])])) as Record<Verdict, number>;

  const hoaxAt = CLASSES.indexOf("hoax");
  const validAt = CLASSES.indexOf("valid");
  const contributions: BaselineFeature[] = [];
  for (let i = 0; i < vec.idx.length; i++) {
    const j = vec.idx[i];
    const weight = vec.val[i] * (model.weights[j * K + hoaxAt] - model.weights[j * K + validAt]);
    if (Math.abs(weight) < 1e-3) continue;
    contributions.push({ token: model.vocab[j], weight: round(weight, 3), kind: weight > 0 ? "risk" : "trust" });
  }
  contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return {
    verdict: CLASSES[winner],
    probabilities,
    hoaxProbability: round(p[hoaxAt] + 0.5 * p[CLASSES.indexOf("misleading")]),
    confidence: round(p[winner]),
    topFeatures: contributions.slice(0, maxFeatures),
    model: model.model,
  };
}

/* --------------------------------------------------------------- status */

export interface ModelStatus {
  /** which engine answers a public check right now */
  engine: "external" | "baseline" | "heuristic";
  external: { configured: boolean; host: string | null; timeoutMs: number };
  baseline: {
    available: boolean;
    trainedAt: string;
    docs: number;
    features: number;
    accuracy: number;
    macroF1: number;
    textVariant: TextVariant;
  } | null;
}

/** Engine order: external model, then the baseline, then the keyword heuristic. */
export function modelStatus(): ModelStatus {
  const url = process.env.MODEL_API_URL || "";
  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host;
    } catch {
      host = url.slice(0, 80);
    }
  }
  const loaded = loadBaseline();
  const m = loaded?.model;
  return {
    engine: url ? "external" : m ? "baseline" : "heuristic",
    external: { configured: !!url, host, timeoutMs: Number(process.env.MODEL_TIMEOUT_MS) || 15_000 },
    baseline: m
      ? { available: true, trainedAt: m.trainedAt, docs: m.docs, features: m.features, accuracy: m.accuracy, macroF1: m.macroF1, textVariant: m.textVariant }
      : null,
  };
}

/** Everything the admin page shows about the model file; null without a model. */
export function baselineInfo(): (BaselineMetrics & { path: string; sizeBytes: number }) | null {
  const loaded = loadBaseline();
  return loaded ? { ...metricsOf(loaded.model), path: loaded.path, sizeBytes: loaded.sizeBytes } : null;
}
