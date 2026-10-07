import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A throwaway database for this file; set before the lib is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-settings-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const s = await import("@/lib/settings");

describe("stopwords", () => {
  it("normalizes, de-duplicates and counts per language", () => {
    expect(s.normalizeWord("  Hoäx ")).toBe("hoax");
    expect(s.addStopwords("id", ["yang", "Dan", "yang", "", "  "])).toBe(2);
    expect(s.addStopwords("id", ["dan"])).toBe(0);
    expect(s.addStopwords("en", ["the"], "legacy")).toBe(1);
    expect(s.countStopwords()).toEqual({ en: 1, id: 2, ms: 0 });
    expect(s.getStopwords("id").has("dan")).toBe(true);
    expect(s.getStopwords("ms").size).toBe(0);
  });

  it("lists with search and paging, and refreshes the cache on delete", () => {
    const page = s.listStopwords("id", "ya");
    expect(page.items.map((w) => w.word)).toEqual(["yang"]);
    expect(page).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(s.listStopwords("id", "", 1, 1)).toMatchObject({ total: 2, pages: 2 });
    expect(s.listStopwords("id", "", 9, 1).page).toBe(2);

    s.removeStopword(page.items[0].id);
    expect(s.getStopwords("id").has("yang")).toBe(false);
    expect(s.listStopwords("id").items.map((w) => w.word)).toEqual(["dan"]);
    expect(s.listStopwords("en").items[0]).toMatchObject({ word: "the", origin: "legacy" });
  });

  it("knows the three languages", () => {
    expect(s.SETTING_LANGS.map((l) => l.code)).toEqual(["en", "id", "ms"]);
    expect(s.isSettingLang("ms")).toBe(true);
    expect(s.isSettingLang("fr")).toBe(false);
  });
});

describe("html tags", () => {
  it("stores replacements and applies entity names with an ampersand, other tags as they are", () => {
    s.saveHtmlTag("#8216;", "'");
    s.saveHtmlTag("amp;", "&");
    s.saveHtmlTag("’", "'");
    s.saveHtmlTag("&quot;", '"');
    s.saveHtmlTag("nbsp;", "");
    expect(s.listHtmlTags().map((t) => t.tag)).toEqual(["#8216;", "amp;", "’", "&quot;", "nbsp;"]);
    expect(s.applyHtmlTags("it&#8216;s a&nbsp;test ’ok&quot; &amp; done")).toBe("it's atest 'ok\" & done");
  });

  it("updates in place, overwrites on the same tag, and deletes", () => {
    const row = s.listHtmlTags().find((t) => t.tag === "#8216;")!;
    s.saveHtmlTag("#8216;", "`", row.id);
    expect(s.listHtmlTags().find((t) => t.id === row.id)).toMatchObject({ tag: "#8216;", alt: "`" });
    s.saveHtmlTag("amp;", "and");
    expect(s.listHtmlTags().filter((t) => t.tag === "amp;")).toHaveLength(1);
    expect(s.listHtmlTags().find((t) => t.tag === "amp;")!.alt).toBe("and");
    s.removeHtmlTag(row.id);
    expect(s.listHtmlTags().some((t) => t.id === row.id)).toBe(false);
    s.saveHtmlTag("   ", "x");
    expect(s.listHtmlTags().some((t) => t.alt === "x")).toBe(false);
  });
});

describe("skip domains", () => {
  it("normalizes hostnames and URLs and matches parent domains", () => {
    expect(s.normalizeDomain("https://www.Facebook.com/some/page")).toBe("facebook.com");
    expect(s.normalizeDomain("WWW.Twitter.com/")).toBe("twitter.com");
    expect(s.addSkipDomain("https://www.Facebook.com/some/page", "social network")).toBe(true);
    expect(s.addSkipDomain("facebook.com")).toBe(false);
    expect(s.addSkipDomain("not a domain")).toBe(false);
    expect(s.addSkipDomain("localhost")).toBe(false);
    expect(s.listSkipDomains()).toEqual([expect.objectContaining({ domain: "facebook.com", note: "social network" })]);

    expect(s.isSkippedDomain("facebook.com")).toBe(true);
    expect(s.isSkippedDomain("m.facebook.com")).toBe(true);
    expect(s.isSkippedDomain("WWW.FACEBOOK.COM")).toBe(true);
    expect(s.isSkippedDomain("notfacebook.com")).toBe(false);
    expect(s.isSkippedDomain("")).toBe(false);

    s.removeSkipDomain(s.listSkipDomains()[0].id);
    expect(s.isSkippedDomain("facebook.com")).toBe(false);
  });
});
