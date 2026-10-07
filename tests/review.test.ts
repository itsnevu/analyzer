import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";

// A throwaway database for this file; set before the store is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-review-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const store = await import("@/lib/articles");
const review = await import("@/lib/review");
const { getDb } = await import("@/lib/db");

const hidden = (slug: string, title: string, extra: Partial<Article> = {}): Article => ({
  slug,
  title,
  lang: "id",
  category: "Unrated",
  verdict: "misleading",
  date: "2019-02-17",
  summaryId: "",
  summaryEn: "",
  source: "",
  narration: "Klaim yang beredar.",
  explanation: "Penjelasan ".repeat(60).trim(),
  reference: "",
  image: "",
  originalUrl: "https://www.liputan6.com/cek-fakta/read/1/judul",
  published: false,
  ...extra,
});

beforeAll(async () => {
  await store.listArticles(); // seeds the built-in examples, all published
  await store.saveArticle(hidden("debat-1", "Cek Fakta: Klaim Jokowi soal Impor Jagung", { date: "2019-02-17" }));
  await store.saveArticle(hidden("debat-2", "Cek Fakta: Klaim Prabowo soal Lahan", { date: "2019-02-18", narration: "" }));
  await store.saveArticle(hidden("debat-3", "Cek Fakta: Klaim soal Unicorn", { date: "2019-02-19" }));
  getDb().prepare("UPDATE articles SET label = 'INFORMATION', sourceSite = 'liputan6.com' WHERE slug = 'debat-1'").run();
});

describe("review queue", () => {
  it("lists only hidden articles, newest first, with excerpts and the legacy label", async () => {
    const q = await review.listReviewQueue();
    expect(q.total).toBe(3);
    expect(q.items.map((i) => i.slug)).toEqual(["debat-3", "debat-2", "debat-1"]);
    const first = q.items.find((i) => i.slug === "debat-1")!;
    expect(first).toMatchObject({ label: "INFORMATION", sourceSite: "liputan6.com", originalUrl: "https://www.liputan6.com/cek-fakta/read/1/judul", lang: "id" });
    expect(first.explanation.length).toBe(review.EXCERPT_CHARS);
    expect(first.explanationLength).toBeGreaterThan(review.EXCERPT_CHARS);
    expect(q.items.find((i) => i.slug === "debat-2")?.narration).toBe("");
  });

  it("respects the limit but reports the full total", async () => {
    const q = await review.listReviewQueue(2);
    expect(q.items).toHaveLength(2);
    expect(q.total).toBe(3);
  });
});

describe("decisions", () => {
  it("publishes with the verdict's category words", async () => {
    expect(await review.reviewArticle("debat-1", "hoax")).toBe(true);
    expect(await store.getArticleBySlug("debat-1")).toMatchObject({ verdict: "hoax", category: "Hoax", published: true, sourceSite: "liputan6.com" });

    expect(await review.reviewArticle("debat-2", "valid")).toBe(true);
    expect(await store.getArticleBySlug("debat-2")).toMatchObject({ verdict: "valid", category: "Verified", published: true });

    expect(review.REVIEW_RESULT.misleading).toEqual({ verdict: "misleading", category: "Disinformation" });
  });

  it("deletes, and reports unknown slugs", async () => {
    expect(await review.reviewArticle("debat-3", "delete")).toBe(true);
    expect(await store.getArticleBySlug("debat-3", true)).toBeUndefined();
    expect(await review.reviewArticle("no-such", "hoax")).toBe(false);
    expect((await review.listReviewQueue()).total).toBe(0);
  });

  it("knows its actions", () => {
    expect(review.isReviewAction("valid")).toBe(true);
    expect(review.isReviewAction("publish")).toBe(false);
  });
});
