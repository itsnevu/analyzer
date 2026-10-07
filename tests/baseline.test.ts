import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// A throwaway database and model file for this file; set before the modules load.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-baseline-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
const MODEL = path.join(dir, "models", "baseline.json");
process.env.BASELINE_MODEL_PATH = MODEL;
process.env.RAG_FUSION_API_URL = "";

const baseline = await import("@/lib/baseline");
const { getDb } = await import("@/lib/db");
const { runDetection } = await import("@/lib/detect");

/* ------------------------------------------------------ synthetic corpus */

const WORDS = {
  hoax: ["vaksin", "chip", "magnet", "sebarkan", "dihapus", "konspirasi", "rahasia", "dokter", "mikrocip", "pelacak", "5g", "racun"],
  misleading: ["foto", "lama", "konteks", "diunggah", "ulang", "kejadian", "2019", "dipotong", "judul", "berbeda", "klip", "suntingan"],
  valid: ["kementerian", "menyatakan", "resmi", "siaran", "pers", "laporan", "statistik", "menteri", "konferensi", "anggaran", "jubir", "rilis"],
} as const;
const SHARED = ["warga", "jakarta", "indonesia", "hari", "pagi", "kabar", "video", "pesan", "grup", "keluarga", "kota", "masyarakat"];
const TAG = { hoax: "[SALAH]", misleading: "[DISINFORMASI]", valid: "[BENAR]" } as const;
const PER_CLASS = 40;

// Deterministic, so a failure is reproducible.
let seed = 12345;
const random = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (list: readonly string[], n: number) => Array.from({ length: n }, () => list[Math.floor(random() * list.length)]);

beforeAll(() => {
  const db = getDb();
  const insert = db.prepare("INSERT INTO articles (slug, title, lang, category, verdict, date, narration, explanation, published) VALUES (?, ?, 'id', 'Hoax', ?, '2021-01-01', ?, ?, ?)");
  let i = 0;
  for (const verdict of baseline.CLASSES) {
    for (let k = 0; k < PER_CLASS; k++) {
      const words = [...pick(WORDS[verdict], 5), ...pick(SHARED, 3)];
      const title = `${TAG[verdict]} ${words.slice(0, 3).join(" ")}`;
      insert.run(`doc-${i++}`, title, verdict, words.join(" "), `Faktanya ${verdict} cek fakta`, 1);
    }
  }
  // Hidden rows are not reviewed and must not be trained on.
  insert.run("hidden", "[SALAH] kementerian resmi siaran pers", "hoax", "kementerian resmi siaran pers laporan", "", 0);
});

afterEach(() => vi.unstubAllEnvs());

/* ------------------------------------------------------------ features */

describe("featuriser", () => {
  it("folds accents and case, keeps digits, forms bigrams, skips one-letter and function words", () => {
    expect(baseline.featureTokens("Vaksin COVID-19 mengandung chip!")).toEqual([
      "vaksin", "vaksin covid", "covid", "covid 19", "19", "19 mengandung", "mengandung", "mengandung chip", "chip",
    ]);
    // "à" folds to a one-letter token, which is skipped without breaking the bigram.
    expect(baseline.featureTokens("Médecin à Paris")).toEqual(["medecin", "medecin paris", "paris"]);
    // "yang" is a function word: no feature of its own and no bigram across it.
    expect(baseline.featureTokens("vaksin yang mengandung")).toEqual(["vaksin", "mengandung"]);
    expect(baseline.foldTokens("a I")).toEqual([]);
  });

  it("never turns a tag or a verdict word into a feature", () => {
    expect(baseline.stripTag("[SALAH] Pengantin di Ghana")).toBe("Pengantin di Ghana");
    expect(baseline.stripTag("(HOAX): Ahok masih berkeliaran")).toBe("Ahok masih berkeliaran");
    expect(baseline.stripTag("[Fakta atau Hoaks] [KLARIFIKASI] Benarkah X?")).toBe("Benarkah X?");
    expect(baseline.stripTag("Lawan Konten Negatif")).toBe("Lawan Konten Negatif");
    const tokens = baseline.featureTokens("[SALAH] Cek Fakta: HOAKS vaksin benar FALSE fake misleading, faktanya disinformasi hoax");
    expect(tokens).toEqual(["vaksin"]);
    for (const t of tokens) for (const w of t.split(" ")) expect(baseline.VERDICT_WORDS.has(w)).toBe(false);
    const text = baseline.trainingText({ title: "[HOAKS] Vaksin chip", narration: "", summaryId: "ringkasan klaim", summaryEn: "", explanation: "penjelasan" }, "claim");
    expect(text).toBe("Vaksin chip\nringkasan klaim");
    expect(baseline.trainingText({ title: "[HOAKS] Vaksin chip", narration: "narasi", summaryId: "ringkasan", summaryEn: "", explanation: "penjelasan" }, "claim+explanation")).toBe("Vaksin chip\nnarasi\npenjelasan");
  });
});

/* ------------------------------------------------------------- training */

describe("training and prediction", () => {
  it("trains on the published rows, reports holdout metrics and writes the model", () => {
    const m = baseline.trainBaseline(getDb());
    expect(m.docs + m.holdout).toBe(PER_CLASS * 3);
    expect(m.holdout).toBe(12);
    expect(m.features).toBeGreaterThan(20);
    expect(m.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(m.macroF1).toBeGreaterThanOrEqual(0.9);
    expect(Object.keys(m.perClass).sort()).toEqual(["hoax", "misleading", "valid"]);
    expect(m.confusion.flat().reduce((a, b) => a + b, 0)).toBe(m.holdout);
    expect(m.textVariant).toBe("claim");
    expect(m.temperature).toBeGreaterThan(0);
    expect(fs.existsSync(MODEL)).toBe(true);

    const file = JSON.parse(fs.readFileSync(MODEL, "utf8")) as { vocab: string[]; weights: number[]; idf: number[] };
    expect(file.weights.length).toBe(file.vocab.length * 3);
    expect(file.idf.length).toBe(file.vocab.length);
    for (const tok of file.vocab) {
      expect(tok).not.toMatch(/[[\]()]/);
      for (const w of tok.split(" ")) expect(baseline.VERDICT_WORDS.has(w)).toBe(false);
    }
    // The hidden row's words only appear in it, so they cannot have reached the vocabulary twice.
    expect(file.vocab.includes("siaran pers laporan")).toBe(false);
  });

  it("predicts with sensible probabilities and cues", () => {
    expect(baseline.baselineAvailable()).toBe(true);
    const p = baseline.predictBaseline("Hati-hati, vaksin mengandung chip magnet pelacak. Sebarkan ke grup keluarga sebelum dihapus!");
    expect(p?.verdict).toBe("hoax");
    expect(p?.model).toBe("baseline-lr");
    const probs = p!.probabilities;
    expect(probs.hoax + probs.misleading + probs.valid).toBeCloseTo(1, 3);
    expect(p!.hoaxProbability).toBeCloseTo(probs.hoax + 0.5 * probs.misleading, 3);
    expect(p!.confidence).toBeCloseTo(Math.max(probs.hoax, probs.misleading, probs.valid), 3);
    // A toy corpus is perfectly separable, so only the range is checked here; the real archive calibrates to about 1.3.
    for (const v of Object.values(probs)) expect(v).toBeGreaterThanOrEqual(0);
    expect(baseline.loadBaseline()!.model.temperature).toBeGreaterThanOrEqual(0.3);
    expect(baseline.loadBaseline()!.model.temperature).toBeLessThanOrEqual(5);
    expect(p!.topFeatures.length).toBeGreaterThan(0);
    expect(p!.topFeatures.some((f) => f.token === "vaksin" && f.kind === "risk")).toBe(true);
    for (const f of p!.topFeatures) expect(["risk", "trust"]).toContain(f.kind);

    const credible = baseline.predictBaseline("Kementerian menyatakan dalam siaran pers resmi: laporan statistik anggaran");
    expect(credible?.verdict).toBe("valid");
    expect(credible!.topFeatures.some((f) => f.kind === "trust")).toBe(true);

    // Nothing the model knows: no verdict, so the caller falls back.
    expect(baseline.predictBaseline("zzzz qqqq xxxx")).toBeNull();
  });

  it("answers public checks through runDetection as a simulated result", async () => {
    const r = await runDetection("Vaksin mengandung chip magnet pelacak, sebarkan ke grup keluarga sebelum dihapus!!!");
    expect(r.simulated).toBe(true);
    expect(r.fallbackReason).toBeUndefined();
    expect(r.model).toBe("baseline-lr");
    expect(r.verdict).toBe("hoax");
    expect(r.signals.some((s) => s.label.startsWith("word: "))).toBe(true);
    expect(r.signals.some((s) => s.label === "excessive exclamation marks")).toBe(true);
    expect(r.explanation).toMatch(/baseline classifier/);
    expect(r.category).toBe("Disinformation");
  });

  it("predicts well under 50 ms", () => {
    const text = "Vaksin chip magnet sebarkan dokter rahasia foto lama konteks kementerian resmi laporan warga jakarta ".repeat(60);
    expect(text.length).toBeGreaterThan(5000);
    baseline.predictBaseline(text);
    const started = performance.now();
    for (let i = 0; i < 20; i++) baseline.predictBaseline(text);
    expect((performance.now() - started) / 20).toBeLessThan(50);
  });
});

/* ------------------------------------------------------- load and status */

describe("model file and status", () => {
  it("reports the baseline as the engine with the model's figures", () => {
    const s = baseline.modelStatus();
    expect(s.engine).toBe("baseline");
    expect(s.external).toEqual({ configured: false, host: null, timeoutMs: 15_000 });
    expect(s.baseline).toMatchObject({ available: true, textVariant: "claim", docs: PER_CLASS * 3 - 12 });
    expect(typeof s.baseline?.trainedAt).toBe("string");
    expect(s.baseline?.accuracy).toBeGreaterThan(0);
    expect(s.baseline?.macroF1).toBeGreaterThan(0);
    expect(s.baseline?.features).toBeGreaterThan(0);
    const info = baseline.baselineInfo();
    expect(info?.path).toBe(MODEL);
    expect(info?.sizeBytes).toBe(fs.statSync(MODEL).size);
  });

  it("puts the external model first when one is configured", () => {
    vi.stubEnv("RAG_FUSION_API_URL", "http://model.test:8000/detect");
    vi.stubEnv("RAG_FUSION_TIMEOUT_MS", "2500");
    const s = baseline.modelStatus();
    expect(s.engine).toBe("external");
    expect(s.external).toEqual({ configured: true, host: "model.test:8000", timeoutMs: 2500 });
    expect(s.baseline?.available).toBe(true);
  });

  it("reloads the file when it changes on disk", () => {
    const before = baseline.loadBaseline()!.model.trainedAt;
    baseline.trainBaseline(getDb(), { seed: 2 });
    // Two writes within the same timestamp tick would look unchanged, so move the clock on.
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(MODEL, later, later);
    const after = baseline.loadBaseline()!.model;
    expect(after.trainedAt >= before).toBe(true);
    expect(baseline.loadBaseline()!.mtimeMs).toBe(fs.statSync(MODEL).mtimeMs);
  });

  it("falls back to the heuristic when the file is gone", async () => {
    fs.rmSync(MODEL);
    expect(baseline.baselineAvailable()).toBe(false);
    expect(baseline.predictBaseline("vaksin chip")).toBeNull();
    expect(baseline.baselineInfo()).toBeNull();
    expect(baseline.modelStatus()).toEqual({ engine: "heuristic", external: { configured: false, host: null, timeoutMs: 15_000 }, baseline: null });
    const r = await runDetection("VIRAL!! SEBARKAN sebelum dihapus, dokter tidak mau kamu tahu rahasia ini!!!");
    expect(r.model).toBe("local-heuristic-stub");
    expect(r.simulated).toBe(true);
  });
});
