import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway database for this file; set before the libs load.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-sources-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const admin = await import("@/lib/sources-admin");
const { panelDb } = await import("@/lib/legacy-panel");

beforeAll(() => {
  const db = panelDb();
  db.prepare("INSERT INTO legacy_sources (id, site, url, lang, description, header, stemming) VALUES (9, 'stophoax.id', 'https://stophoax.id/', 'id', 'Kominfo site', 0, 1)").run();
  db.prepare("INSERT INTO legacy_sources (id, site, url, lang) VALUES (13, 'cekfakta.com', 'https://cekfakta.com/', 'id')").run();
  db.prepare("INSERT INTO crawl_queue (id, sourceId, url, page, lastPage, suffix, status) VALUES (118, 9, 'https://stophoax.id/?s=hoax', 1, 0, '', 'Begin'), (104, NULL, 'https://example.org/page/', 2, 1, '/', 'Finish')").run();
  db.prepare("INSERT INTO legacy_dataset (id, label, title, url, sourceId) VALUES (1, 'HOAX', 'a', 'https://stophoax.id/a', 9), (2, NULL, 'b', 'https://stophoax.id/b', 9), (3, NULL, 'c', 'https://stophoax.id/c', 9)").run();
  db.prepare("UPDATE legacy_dataset SET adminLabel = 'FACT' WHERE id = 3").run();
  db.prepare("INSERT INTO articles (slug, title, lang, category, verdict, date, sourceSite) VALUES ('x', 'x', 'id', 'Hoax', 'hoax', '2019-01-01', 'stophoax.id')").run();
});

describe("source list", () => {
  it("counts dataset rows by effective label and archive entries, and flags offline sites", () => {
    const list = admin.listSourcesAdmin();
    expect(list.map((s) => s.site)).toEqual(["stophoax.id", "cekfakta.com"]);
    expect(list[0]).toMatchObject({ labeled: 2, unlabeled: 1, articles: 1, offline: true, origin: "legacy", active: true, header: false, stemming: true });
    expect(list[1]).toMatchObject({ labeled: 0, unlabeled: 0, articles: 0, offline: false });
  });

  it("reads the old crawler's listing pages per site", () => {
    expect(admin.getCrawlQueue(9)).toEqual([{ id: 118, sourceId: 9, url: "https://stophoax.id/?s=hoax", page: 1, lastPage: 0, suffix: "", status: "Begin" }]);
    expect(admin.getCrawlQueue(13)).toEqual([]);
    expect(admin.getCrawlQueue().map((q) => q.id)).toEqual([104, 118]);
  });
});

describe("add, edit, delete", () => {
  it("normalizes input", () => {
    expect(admin.normalizeSourceInput({ url: "junk" })).toBeNull();
    expect(admin.normalizeSourceInput({})).toBeNull();
    expect(admin.normalizeSourceInput({ url: "https://www.Example.com/", lang: "ms", header: "yes", stemming: true, active: "no" })).toMatchObject({
      url: "https://www.Example.com/", lang: "ms", header: true, stemming: true, active: false,
    });
    expect(admin.normalizeSourceInput({ url: "example.com", lang: "fr" })!.lang).toBe("");
    expect(admin.siteOf("https://indeks.kompas.com/")).toBe("kompas.com");
    expect(admin.siteOf("www.snopes.com")).toBe("snopes.com");
  });

  it("adds a site with origin 'site' and edits a legacy row without changing its origin", () => {
    const id = admin.saveSource(admin.normalizeSourceInput({ url: "https://www.example.com/", lang: "en", description: "Test" })!);
    expect(id).toBeGreaterThan(13);
    expect(admin.getSourceAdmin(id)).toMatchObject({ site: "example.com", origin: "site", active: true, lang: "en", description: "Test" });

    const legacy = admin.getSourceAdmin(9)!;
    admin.saveSource({ ...legacy, active: false, description: "Parked domain" }, 9);
    expect(admin.getSourceAdmin(9)).toMatchObject({ origin: "legacy", active: false, description: "Parked domain", site: "stophoax.id" });
    expect(admin.saveSource({ ...legacy }, 9999)).toBe(0);
  });

  it("deletes only rows added here", () => {
    const added = admin.listSourcesAdmin().find((s) => s.origin === "site")!;
    expect(admin.deleteSource(9)).toBe("legacy");
    expect(admin.deleteSource(added.id)).toBe("deleted");
    expect(admin.deleteSource(added.id)).toBe("missing");
    expect(admin.getSourceAdmin(9)).not.toBeNull();
  });
});
