import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";

// A throwaway database for this file; set before the stores are loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-stats-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.IP2ASN_DIR = dir; // no network database

const store = await import("@/lib/articles");
const stats = await import("@/lib/stats");
const { insertUsage } = await import("@/lib/usage");

const article = (slug: string, extra: Partial<Article> = {}): Article => ({
  slug,
  title: `[SALAH] ${slug}`,
  lang: "id",
  category: "Hoax",
  verdict: "hoax",
  date: "2010-03-01",
  summaryId: "",
  summaryEn: "",
  source: "",
  narration: "",
  explanation: `Explanation for ${slug}.`,
  reference: "",
  image: "",
  sourceSite: "turnbackhoax.id",
  ...extra,
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const visit = (slug: string, extra: { staff?: number; at?: string } = {}) =>
  insertUsage({ at: extra.at ?? daysAgo(1), kind: "visit", staff: extra.staff ?? 0, path: `/blog/${slug}` });

beforeAll(async () => {
  // The empty store seeds itself with the built-in examples (all dated 2019) on first use.
  await store.listArticles();
  // The seeds are dated 2019; these years are the test's own.
  await store.saveArticle(article("pop-a", { date: "2010-03-01", verdict: "hoax" }));
  await store.saveArticle(article("pop-b", { date: "2012-07-15", verdict: "misleading", lang: "en", sourceSite: "hoax-slayer.com" }));
  await store.saveArticle(article("pop-c", { date: "2012-01-02", verdict: "valid" }));
  await store.saveArticle(article("link-only", { date: "2012-12-31", explanation: "", narration: "" }));
  await store.saveArticle(article("undated", { date: "" }));
  await store.saveArticle(article("hidden-one", { date: "2011-05-05", published: false }));
});

describe("archive aggregation", () => {
  it("counts published entries per year and verdict, with every year in between", () => {
    stats.clearStatsCache();
    const years = stats.archiveByYear();
    const byYear = Object.fromEntries(years.map((y) => [y.year, y.byVerdict]));
    expect(years[0].year).toBe("2010");
    expect(years.map((y) => y.year)).toContain("2011"); // only a hidden entry, still a column
    expect(byYear["2010"]).toEqual({ hoax: 1, misleading: 0, valid: 0 });
    expect(byYear["2011"]).toEqual({ hoax: 0, misleading: 0, valid: 0 });
    expect(byYear["2012"]).toEqual({ hoax: 1, misleading: 1, valid: 1 });
    // Consecutive years, oldest first, up to the seeds' year.
    expect(years.map((y) => Number(y.year))).toEqual(years.map((_, i) => 2010 + i));
    expect(years[years.length - 1].year).toBe("2019");
  });

  it("sums the overview from the same rows", async () => {
    const o = stats.archiveOverview();
    const { total } = await store.listArticles({ pageSize: 1 });
    expect(o.total).toBe(total);
    expect(o.byVerdict.hoax + o.byVerdict.misleading + o.byVerdict.valid).toBe(total);
    expect(o.byLang.id + o.byLang.en).toBe(total);
    expect(o.linkOnly).toBe(1);
    expect(o.withText).toBe(total - 1);
    expect(o.undated).toBe(1);
    expect(o.first).toBe("2010-03-01");
    expect(o.publishers).toBeGreaterThanOrEqual(2);
    const hoaxSlayer = stats.archiveByPublisher().find((p) => p.site === "hoax-slayer.com");
    expect(hoaxSlayer).toEqual({ site: "hoax-slayer.com", total: 1, withText: 1, linkOnly: 0 });
    const tbh = stats.archiveByPublisher().find((p) => p.site === "turnbackhoax.id")!;
    expect(tbh.linkOnly).toBe(1);
  });
});

describe("popular articles", () => {
  it("shows the newest entries while the log is empty", async () => {
    stats.clearStatsCache();
    const r = await stats.popularArticles(30, 5);
    expect(r.popular).toBe(false);
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    expect(r.items.every((a) => a.visits === 0)).toBe(true);
    expect(r.items.map((a) => a.slug)).not.toContain("link-only");
  });

  it("still falls back when fewer than three articles were visited", async () => {
    visit("pop-a");
    visit("pop-b");
    stats.clearStatsCache();
    expect((await stats.popularArticles(30, 5)).popular).toBe(false);
  });

  it("orders visited articles by visits, ignoring staff, old and hidden-article visits", async () => {
    visit("pop-a");
    visit("pop-a");
    visit("pop-b");
    visit("pop-c");
    for (let i = 0; i < 5; i++) visit("hidden-one");
    for (let i = 0; i < 4; i++) visit("pop-c", { staff: 1 });
    for (let i = 0; i < 4; i++) visit("pop-c", { at: daysAgo(45) });
    insertUsage({ at: daysAgo(1), kind: "check", staff: 0, path: "/blog/pop-c" });
    stats.clearStatsCache();

    const r = await stats.popularArticles(30, 5);
    expect(r.popular).toBe(true);
    expect(r.items.map((a) => [a.slug, a.visits])).toEqual([
      ["pop-a", 3],
      ["pop-b", 2],
      ["pop-c", 1],
    ]);
    expect(r.items[0]).toMatchObject({ title: "[SALAH] pop-a", verdict: "hoax", sourceSite: "turnbackhoax.id", published: true });
    expect(r.items.map((a) => a.slug)).not.toContain("hidden-one");
  });

  it("serves the cached answer until the cache is cleared", async () => {
    for (let i = 0; i < 10; i++) visit("pop-c");
    expect((await stats.popularArticles(30, 5)).items[0].slug).toBe("pop-a");
    stats.clearStatsCache();
    expect((await stats.popularArticles(30, 5)).items[0].slug).toBe("pop-c");
  });
});
