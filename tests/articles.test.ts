import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";

// A throwaway database for this file; set before the store is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const store = await import("@/lib/articles");

const article = (slug: string, title: string, explanation: string, extra: Partial<Article> = {}): Article => ({
  slug,
  title,
  lang: "id",
  category: "Hoax",
  verdict: "hoax",
  date: "2021-05-01",
  summaryId: "",
  summaryEn: "",
  source: "",
  narration: "",
  explanation,
  reference: "",
  image: "",
  ...extra,
});

beforeAll(async () => {
  await store.saveArticle(article("vaksin-magnet", "[SALAH] Setelah Divaksin, Tubuh Punya Daya Magnetis", "Vaksin tidak mengandung logam sehingga tidak membuat tubuh menjadi magnet."));
  await store.saveArticle(article("rebusan-sirsak", "[SALAH] Air Rebusan Daun Sirsak Menyembuhkan Kanker", "Belum ada penelitian klinis yang membuktikan daun sirsak menyembuhkan kanker."));
  await store.saveArticle(article("hidden-one", "Draft fact-check about magnet", "Hidden text about vaksin magnet", { published: false }));
});

describe("archive search", () => {
  it("finds articles by words and prefixes, and never shows hidden ones", async () => {
    const byWord = await store.listArticles({ q: "sirsak" });
    expect(byWord.items.map((a) => a.slug)).toEqual(["rebusan-sirsak"]);
    const byPrefix = await store.listArticles({ q: "magnet" });
    expect(byPrefix.items.map((a) => a.slug)).toEqual(["vaksin-magnet"]);
    const admin = await store.listArticles({ q: "magnet", visibility: "all" });
    expect(admin.items.map((a) => a.slug).sort()).toEqual(["hidden-one", "vaksin-magnet"]);
  });

  it("paginates", async () => {
    const page = await store.listArticles({ pageSize: 1, page: 2 });
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2); // the hidden one is left out
    expect(page.pages).toBe(2);
  });
});

describe("similar fact-checks", () => {
  it("matches a reworded claim", async () => {
    const found = await store.findSimilarArticles("Hati-hati, setelah divaksin lengan bisa jadi magnet dan tubuh punya daya magnetis. Sebarkan!");
    expect(found[0]?.slug).toBe("vaksin-magnet");
  });

  it("finds nothing for unrelated text", async () => {
    expect(await store.findSimilarArticles("Resep nasi goreng: tumis bawang merah, masukkan telur, lalu nasi dan kecap manis.")).toEqual([]);
  });
});
