import { describe, expect, it } from "vitest";
import {
  cosineTfidf,
  damerauLevenshtein,
  idfFrom,
  isMethod,
  jaccard,
  levenshtein,
  MAX_TOKENS,
  scorePair,
  sharedWords,
  smithWaterman,
  tokenizeWords,
} from "@/lib/similarity";

const w = (s: string) => s.split(" ");

describe("tokenizeWords", () => {
  it("folds accents and case, drops stopwords and single characters", () => {
    expect(tokenizeWords("Pemerintah MÉNUTUPI fakta, a b!", new Set(["fakta"]))).toEqual(["pemerintah", "menutupi"]);
  });

  it("keeps order and repetition, and caps the length", () => {
    expect(tokenizeWords("satu dua satu tiga")).toEqual(["satu", "dua", "satu", "tiga"]);
    expect(tokenizeWords("satu dua tiga empat", undefined, 2)).toEqual(["satu", "dua"]);
    expect(tokenizeWords(Array.from({ length: 1000 }, (_, i) => `w${i}`).join(" "))).toHaveLength(MAX_TOKENS);
  });
});

const PAIRWISE: [string, (a: string[], b: string[]) => number][] = [
  ["levenshtein", levenshtein],
  ["damerauLevenshtein", damerauLevenshtein],
  ["smithWaterman", smithWaterman],
  ["jaccard", jaccard],
  ["cosineTfidf", (a, b) => cosineTfidf(a, b)],
];

describe.each(PAIRWISE)("%s", (_name, fn) => {
  it("scores identical sequences 1 and disjoint ones 0", () => {
    expect(fn(w("vaksin mengandung microchip"), w("vaksin mengandung microchip"))).toBeCloseTo(1, 10);
    expect(fn(w("vaksin mengandung microchip"), w("resep nasi goreng enak"))).toBe(0);
    expect(fn([], [])).toBe(1);
    expect(fn(w("vaksin"), [])).toBe(0);
  });

  it("is symmetric and stays within 0..1", () => {
    const a = w("hati hati vaksin covid mengandung microchip pelacak sebarkan");
    const b = w("microchip pelacak dalam vaksin covid tidak benar kata kemenkes");
    const s = fn(a, b);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
    expect(fn(b, a)).toBeCloseTo(s, 10);
  });
});

describe("edit distances", () => {
  it("counts word substitutions and insertions", () => {
    // one substitution out of three words
    expect(levenshtein(w("satu dua tiga"), w("satu lima tiga"))).toBeCloseTo(2 / 3);
    // one deletion, normalised by the longer sequence
    expect(levenshtein(w("satu dua tiga"), w("satu tiga"))).toBeCloseTo(2 / 3);
  });

  it("treats a swap of two neighbouring words as one edit only in Damerau", () => {
    const a = w("vaksin covid mengandung microchip");
    const b = w("vaksin mengandung covid microchip");
    expect(levenshtein(a, b)).toBeCloseTo(0.5); // two substitutions
    expect(damerauLevenshtein(a, b)).toBeCloseTo(0.75); // one transposition
    // Without a transposition both agree.
    expect(damerauLevenshtein(w("satu dua tiga"), w("satu lima tiga"))).toBeCloseTo(levenshtein(w("satu dua tiga"), w("satu lima tiga")));
  });
});

describe("smithWaterman", () => {
  it("finds a shared phrase inside otherwise unrelated text", () => {
    const message = w("vaksin covid mengandung microchip bill gates pelacak");
    const page = w(
      "resep nasi goreng spesial tumis bawang merah masukkan telur lalu nasi dan kecap manis " +
        "menurut pesan viral vaksin covid mengandung microchip bill gates pelacak yang beredar di whatsapp " +
        "faktanya kementerian kesehatan membantah tambahkan kerupuk dan acar",
    );
    expect(smithWaterman(message, page)).toBe(1);
    // The global edit distance sees mostly differences.
    expect(levenshtein(message, page)).toBeLessThan(0.3);
  });

  it("scores a half-shared passage by the shorter sequence", () => {
    // "a b" aligned (score 4) over the best possible 2 × 4 words.
    expect(smithWaterman(w("a b c d"), w("x a b y"))).toBeCloseTo(0.5);
  });
});

describe("set and vector measures", () => {
  it("jaccard is shared over union", () => {
    expect(jaccard(w("a b c"), w("b c d"))).toBeCloseTo(0.5);
    expect(jaccard(w("a a a b"), w("a b"))).toBe(1); // repetition does not count
  });

  it("plain cosine counts frequencies", () => {
    expect(cosineTfidf(w("a b"), w("a c"))).toBeCloseTo(0.5);
    expect(cosineTfidf(w("a a b"), w("a b b"))).toBeCloseTo(0.8); // (2+2) / (sqrt5 · sqrt5)
  });

  it("IDF makes a word that every document has count less", () => {
    const docs = [w("a b"), w("a c"), w("a d")];
    const idf = idfFrom(docs);
    expect(idf("a")).toBeLessThan(idf("b"));
    expect(idf("never seen")).toBeCloseTo(idf("b"));
    expect(cosineTfidf(w("a b"), w("a c"), idf)).toBeLessThan(cosineTfidf(w("a b"), w("a c")));
  });

  it("lists shared words, rarest first when an IDF is given", () => {
    expect(sharedWords(w("a b c b"), w("c b z"))).toEqual(["b", "c"]);
    const idf = idfFrom([w("a b c"), w("a c"), w("a")]);
    expect(sharedWords(w("a b c"), w("c b a"), 8, idf)).toEqual(["b", "c", "a"]);
    expect(sharedWords(w("a b c"), w("c b a"), 1)).toHaveLength(1);
  });
});

describe("dispatcher", () => {
  it("knows the methods and routes to them", () => {
    expect(isMethod("smith-waterman")).toBe(true);
    expect(isMethod("soundex")).toBe(false);
    expect(scorePair("jaccard", w("a b"), w("b c"))).toBeCloseTo(1 / 3);
    expect(scorePair("damerau", w("a b"), w("b a"))).toBeCloseTo(0.5);
  });
});

describe("speed", () => {
  it("compares two full-length sequences in well under a second each", () => {
    const rand = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const r1 = rand(7);
    const r2 = rand(11);
    const a = Array.from({ length: MAX_TOKENS }, () => `w${Math.floor(r1() * 900)}`);
    const b = Array.from({ length: MAX_TOKENS }, () => `w${Math.floor(r2() * 900)}`);
    for (const [name, fn] of PAIRWISE) {
      const t = performance.now();
      for (let i = 0; i < 10; i++) fn(a, b);
      const perPair = (performance.now() - t) / 10;
      expect(perPair, `${name} took ${perPair.toFixed(1)} ms per pair`).toBeLessThan(250);
    }
  });
});
