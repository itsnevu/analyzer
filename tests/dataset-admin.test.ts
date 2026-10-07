import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway database and a tiny panel export for this file; set before the libs load.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-dataset-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.LEGACY_PANEL_DIR = dir;
fs.writeFileSync(
  path.join(dir, "hoax-master-data-categorized.json"),
  JSON.stringify({
    records: "1",
    rows: [
      {
        id: "101",
        text_category: "HOAX",
        title: "[SALAH] Vaksin Mengandung Microchip 5G",
        author: "",
        publish_date: "Februari18,2022",
        text:
          "Klaim tersebut tidak benar. Selengkapnya di bagian PENJELASAN = = = = = NARASI: “Vaksin mengandung microchip 5G.” = = = = = " +
          "PENJELASAN: Faktanya, vaksin tidak mengandung microchip. BPOM sudah memastikan kandungannya aman. = = = = = REFERENSI: https://turnbackhoax.id/ref",
        url: "https://turnbackhoax.id/2022/02/18/salah-vaksin-microchip/",
        website: "10",
      },
    ],
  }),
);

const admin = await import("@/lib/dataset-admin");
const { panelDb, getDatasetOverview, getDatasetSources } = await import("@/lib/legacy-panel");

beforeAll(() => {
  const db = panelDb();
  db.prepare("INSERT INTO legacy_sources (id, site, url, lang) VALUES (10, 'turnbackhoax.id', 'https://turnbackhoax.id/', 'id'), (2, 'hoax-slayer.com', 'https://www.hoax-slayer.com/', 'en')").run();
  const insert = db.prepare("INSERT INTO legacy_dataset (id, label, title, publishedOn, url, sourceId) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run(101, "HOAX", "[SALAH] Vaksin Mengandung Microchip 5G", "2022-02-18", "https://turnbackhoax.id/2022/02/18/salah-vaksin-microchip/", 10);
  insert.run(102, "DISINFORMATION", "[DISINFORMASI] Foto Banjir Jakarta", "2021-05-01", "https://turnbackhoax.id/2021/05/01/banjir/", 10);
  insert.run(103, null, "Facebook Hacker Warning", "2020-01-01", "https://www.hoax-slayer.com/facebook-hacker.shtml", 2);
  insert.run(104, "UNKNOWN", "Pesan berantai tanpa kejelasan", "2019-03-03", "https://turnbackhoax.id/2019/03/03/pesan/", 10);
  insert.run(105, "INFORMATION", "[KLARIFIKASI] Penjelasan Resmi Kementerian", "2021-07-07", "https://turnbackhoax.id/2021/07/07/klarifikasi/", 10);
});

describe("dataset browser", () => {
  it("splits the tabs by the effective label and filters", () => {
    expect(admin.listDataset({}).total).toBe(4);
    expect(admin.listDataset({ tab: "uncategorized" }).items.map((r) => r.id)).toEqual([103]);
    expect(admin.listDataset({ label: "HOAX" }).items.map((r) => r.id)).toEqual([101]);
    expect(admin.listDataset({ q: "microchip" }).items.map((r) => r.id)).toEqual([101]);
    expect(admin.listDataset({ year: "2021" }).items.map((r) => r.id)).toEqual([105, 102]);
    expect(admin.listDataset({ tab: "uncategorized", source: 2 }).total).toBe(1);
    expect(admin.listDataset({ source: 2 }).total).toBe(0);
    expect(admin.listDataset({ archived: "yes" }).total).toBe(0);
    expect(admin.listDataset({ pageSize: 2, page: 2 }).items).toHaveLength(2);
    expect(admin.getDatasetYears()).toEqual(["2022", "2021", "2020", "2019"]);
    expect(admin.getDatasetSourceOptions()[0]).toMatchObject({ id: 10, site: "turnbackhoax.id", count: 4 });
  });

  it("lets an admin label win over the imported one, everywhere", () => {
    expect(admin.setDatasetLabel(103, "FACT")).toBe(true);
    const item = admin.getDatasetItem(103)!;
    expect(item).toMatchObject({ label: null, adminLabel: "FACT", effectiveLabel: "FACT" });
    expect(item.reviewedAt).toBeTruthy();
    expect(admin.listDataset({ tab: "uncategorized" }).total).toBe(0);
    expect(admin.listDataset({ label: "FACT" }).items.map((r) => r.id)).toEqual([103]);
    expect(getDatasetOverview()).toMatchObject({ labeled: 5, unlabeled: 0 });
    expect(getDatasetSources().find((s) => s.site === "hoax-slayer.com")).toMatchObject({ labeled: 1, unlabeled: 0 });

    expect(admin.setDatasetLabel(103, null)).toBe(true);
    expect(admin.getDatasetItem(103)!.effectiveLabel).toBeNull();
    expect(getDatasetOverview().unlabeled).toBe(1);
    expect(admin.setDatasetLabel(999, "HOAX")).toBe(false);
  });

  it("exports the filter as CSV", () => {
    const lines = [...admin.datasetCsv({ label: "HOAX" })];
    expect(lines[0]).toBe("﻿id,label,adminLabel,effectiveLabel,reviewedAt,title,publishedOn,url,site,archiveSlug\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("101,HOAX,,HOAX,,[SALAH] Vaksin Mengandung Microchip 5G,2022-02-18,");
  });
});

describe("add to archive", () => {
  it("builds a published article with the exported text, like the import script", () => {
    const r = admin.addDatasetRowToArchive(101);
    expect(r).toMatchObject({ ok: true, published: true, withText: true });
    if (!r.ok) return;
    expect(r.slug).toBe("salah-vaksin-mengandung-microchip-5g-d101");
    const a = panelDb().prepare("SELECT * FROM articles WHERE datasetId = 101").get() as Record<string, unknown>;
    expect(a).toMatchObject({ slug: r.slug, verdict: "hoax", category: "Hoax", lang: "id", date: "2022-02-18", sourceSite: "turnbackhoax.id", label: "HOAX", published: 1 });
    expect(String(a.narration)).toContain("microchip 5G");
    expect(String(a.explanation)).toContain("BPOM");
    expect(String(a.reference)).toContain("https://turnbackhoax.id/ref");
    expect(admin.getDatasetItem(101)).toMatchObject({ archiveSlug: r.slug, archivePublished: true });
    expect(admin.listDataset({ archived: "yes" }).items.map((x) => x.id)).toEqual([101]);
  });

  it("refuses a row that is already there", () => {
    expect(admin.addDatasetRowToArchive(101)).toMatchObject({ ok: false, status: 409, slug: "salah-vaksin-mengandung-microchip-5g-d101" });
    expect(admin.addDatasetRowToArchive(999)).toMatchObject({ ok: false, status: 404 });
  });

  it("hides a row whose label gives no verdict and falls back to the dataset date", () => {
    const r = admin.addDatasetRowToArchive(104);
    expect(r).toMatchObject({ ok: true, published: false, withText: false });
    const a = panelDb().prepare("SELECT published, verdict, date, originalUrl FROM articles WHERE datasetId = 104").get() as Record<string, unknown>;
    expect(a).toMatchObject({ published: 0, verdict: "misleading", date: "2019-03-03", originalUrl: "https://turnbackhoax.id/2019/03/03/pesan/" });
  });

  it("uses the admin label and spots a twin that shares the link", () => {
    admin.setDatasetLabel(105, "FACT");
    const r = admin.addDatasetRowToArchive(105);
    expect(r).toMatchObject({ ok: true, published: true });
    expect(panelDb().prepare("SELECT verdict, category FROM articles WHERE datasetId = 105").get()).toEqual({ verdict: "valid", category: "Verified" });

    panelDb()
      .prepare("INSERT INTO articles (slug, title, lang, category, verdict, date, originalUrl) VALUES ('wp-copy-77', 'Banjir', 'id', 'Hoax', 'hoax', '2021-05-01', 'http://www.turnbackhoax.id/2021/05/01/banjir/')")
      .run();
    expect(admin.addDatasetRowToArchive(102)).toMatchObject({ ok: false, status: 409, slug: "wp-copy-77" });
  });
});
