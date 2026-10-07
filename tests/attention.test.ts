import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";
import type { UsageRow } from "@/lib/usage";

// A throwaway database for this file; set before the modules are loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-attention-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.IP2ASN_DIR = dir;

const attention = await import("@/lib/attention");
const { insertUsage } = await import("@/lib/usage");
const store = await import("@/lib/articles");

const HOUR = 3_600_000;
let seq = 0;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

/** A public check that went through and found nothing in the archive, unless `extra` says otherwise. Each one is an hour older than the last. */
function check(text: string, extra: Partial<UsageRow> = {}): number {
  return insertUsage({
    at: ago(++seq), kind: "check", staff: 0, error: "", input: "text", text, url: "", pageTitle: "", lang: "id",
    verdict: "misleading", probability: 0.5, engine: "baseline", matches: 0, topMatch: "", ...extra,
  });
}

const article = (slug: string, title: string, verdict: Article["verdict"]): Article => ({
  slug, title, lang: "id", category: "Hoax", verdict, date: "2024-01-10", summaryId: "", summaryEn: "", source: "",
  narration: "Klaim yang beredar.", explanation: "Penjelasan.", reference: "", image: "", published: true,
});

const CLAIM = "Pemerintah akan membagikan bantuan 2 juta rupiah untuk semua warga lewat link ini";
const CLAIM_LONG = "Pemerintah akan membagikan bantuan 2 juta rupiah untuk semua warga, daftar lewat link ini sekarang";

beforeAll(async () => {
  await store.saveArticle(article("hoax-a", "[SALAH] Bantuan 2 juta", "hoax"));
  await store.saveArticle(article("valid-b", "[BENAR] Jadwal libur nasional", "valid"));

  // Group A: three wordings of one claim.
  check(CLAIM, { probability: 0.8, verdict: "hoax" });
  check(CLAIM_LONG, { probability: 0.7, verdict: "hoax" });
  check(`${CLAIM.toLowerCase()}!!`, { probability: 0.9, verdict: "misleading", lang: "ms", engine: "heuristic" });
  // Group B: unrelated and credible-looking.
  check("Vaksin menyebabkan autisme menurut penelitian terbaru di Jepang", { probability: 0.3, verdict: "valid" });
  // Group C: the engine was unsure.
  check("Harga BBM naik besok pagi kata menteri", { probability: 0.5 });
  // One link checked twice, the second time with a trailing slash and no title.
  check("https://example.com/berita/1", { url: "https://example.com/berita/1", input: "link", pageTitle: "Berita satu", probability: 0.75 });
  check("https://example.com/berita/1/", { url: "https://example.com/berita/1/", input: "link", pageTitle: "", probability: 0.75 });
  // Matched checks are never "unmatched". Two of them contradict their match.
  check("Bantuan 2 juta rupiah dibagikan", { matches: 2, topMatch: "hoax-a", probability: 0.2, verdict: "hoax" });
  check("Bantuan 2 juta rupiah untuk warga", { matches: 1, topMatch: "hoax-a", probability: 0.9, verdict: "hoax" });
  check("Libur nasional pekan depan", { matches: 1, topMatch: "valid-b", probability: 0.8, verdict: "valid" });
  check("Libur nasional dua hari", { matches: 1, topMatch: "valid-b", probability: 0.1, verdict: "valid" });
  check("Cocok dengan artikel yang sudah dihapus", { matches: 1, topMatch: "gone-slug", probability: 0.5 });
  check("Cocok tapi ragu", { matches: 1, topMatch: "hoax-a", probability: 0.5 });
  // Never shown: the admin's own check, a failed check, and one older than the window.
  check("Tes dari admin", { staff: 1 });
  check("x", { error: "too-short" });
  check("Berita lama yang tidak cocok", { at: ago(40 * 24) });
});

describe("unmatched claims", () => {
  it("groups near-duplicate wordings and keeps the longest as representative", () => {
    const { groups, total, scanned, dismissed } = attention.listAttention(30);
    expect(total).toBe(4);
    expect(dismissed).toBe(0);
    expect(scanned).toBe(7);
    const a = groups[0];
    expect(a).toMatchObject({ count: 3, text: CLAIM_LONG, chars: CLAIM_LONG.length, verdict: "hoax", isLink: false });
    expect(a.probability).toBeCloseTo(0.8, 5);
    expect(a.langs).toEqual(["id", "ms"]);
    expect(a.engines).toEqual(["baseline", "heuristic"]);
    expect(a.key).toBe(attention.attentionKey(CLAIM_LONG));
    expect(a.firstSeen < a.lastSeen).toBe(true);
  });

  it("groups link checks by address and sorts by count, then probability", () => {
    const { groups } = attention.listAttention(30);
    expect(groups.map((g) => g.count)).toEqual([3, 2, 1, 1]);
    expect(groups[1]).toMatchObject({ isLink: true, url: "https://example.com/berita/1", pageTitle: "Berita satu", count: 2, text: "https://example.com/berita/1" });
    expect(groups[2].text).toContain("Harga BBM");
    expect(groups[3].text).toContain("Vaksin");
  });

  it("leaves out matched, staff, failed and old checks, unless the window is widened", () => {
    const texts = attention.listAttention(30).groups.map((g) => g.text).join("\n");
    for (const t of ["Bantuan 2 juta rupiah dibagikan", "Tes dari admin", "Berita lama"]) expect(texts).not.toContain(t);
    expect(texts).not.toMatch(/^x$/m);
    expect(attention.listAttention(90).total).toBe(5);
    expect(attention.listAttention(7).total).toBe(4);
  });

  it("keys the same words regardless of case, spacing and punctuation", () => {
    expect(attention.attentionKey("Hello,   WORLD!")).toBe(attention.attentionKey("hello world"));
    expect(attention.attentionKey("hello world")).not.toBe(attention.attentionKey("hello there"));
    expect(attention.attentionKey("x")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reads its parameters leniently", () => {
    expect(attention.attentionDays("90")).toBe(90);
    expect(attention.attentionDays("12")).toBe(30);
    expect(attention.attentionTab("low")).toBe("low");
    expect(attention.attentionTab("nope")).toBe("unmatched");
  });
});

describe("dismissing", () => {
  it("hides a group, survives a new representative, and can be undone", () => {
    const key = attention.listAttention(30).groups[0].key;
    attention.dismissAttention(key);
    attention.dismissAttention(key); // twice is fine
    expect(attention.listAttention(30)).toMatchObject({ total: 3, dismissed: 1 });
    expect(attention.countOpenAttention(30)).toBe(3);
    expect(attention.listAttention(30).groups.some((g) => g.text === CLAIM_LONG)).toBe(false);

    // An even longer wording arrives: the representative changes, but the group stays hidden.
    check(`${CLAIM_LONG} Sebarkan ke semua grup keluarga.`, { probability: 0.8 });
    expect(attention.listAttention(30)).toMatchObject({ total: 3, dismissed: 1 });

    expect(attention.restoreAttention(key)).toBe(true);
    expect(attention.restoreAttention(key)).toBe(false);
    const back = attention.listAttention(30);
    expect(back.total).toBe(4);
    expect(back.groups[0].count).toBe(4);
    expect(attention.countOpenAttention(30)).toBe(4);
  });

  it("refuses keys that are not hashes", () => {
    expect(() => attention.dismissAttention("DROP TABLE")).toThrow();
  });
});

describe("disagreements and low confidence", () => {
  it("lists checks whose match contradicts the engine's probability, newest first", () => {
    const rows = attention.listDisagreements(30);
    expect(rows.map((r) => [r.match.slug, r.band])).toEqual([
      ["hoax-a", "valid"],
      ["valid-b", "hoax"],
    ]);
    expect(rows[0]).toMatchObject({
      text: "Bantuan 2 juta rupiah dibagikan",
      probability: 0.2,
      verdict: "hoax",
      match: { slug: "hoax-a", title: "[SALAH] Bantuan 2 juta", verdict: "hoax", published: true },
    });
  });

  it("lists unmatched checks the engine was unsure about", () => {
    const rows = attention.listLowConfidence(30);
    expect(rows.map((r) => r.text)).toEqual(["Harga BBM naik besok pagi kata menteri"]);
    expect(rows[0]).toMatchObject({ probability: 0.5, engine: "baseline", isLink: false, lang: "id" });
  });
});

describe("dashboard figures", () => {
  it("splits checks by archive match and ranks the matched fact-checks", () => {
    expect(attention.checkMatchSplit(30)).toEqual({ matched: 6, unmatched: 8 });
    expect(attention.topMatchedArticles(30, 5)).toEqual([
      { slug: "hoax-a", title: "[SALAH] Bantuan 2 juta", verdict: "hoax", count: 3 },
      { slug: "valid-b", title: "[BENAR] Jadwal libur nasional", verdict: "valid", count: 2 },
      { slug: "gone-slug", title: "gone-slug", verdict: "misleading", count: 1 },
    ]);
  });

  it("gives one entry per day, oldest first, empty days included", () => {
    const days = attention.checksPerDay(30);
    expect(days).toHaveLength(30);
    expect(days[29].day).toBe(new Date().toISOString().slice(0, 10));
    expect(days.every((d, i) => i === 0 || d.day > days[i - 1].day)).toBe(true);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(14);
  });
});
