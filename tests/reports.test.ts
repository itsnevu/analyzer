import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";

// A throwaway database for this file; set before the modules are loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-reports-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const reports = await import("@/lib/reports");
const store = await import("@/lib/articles");
const { getDb } = await import("@/lib/db");

const article: Article = {
  slug: "jadwal-libur", title: "[BENAR] Jadwal libur nasional", lang: "id", category: "Verified", verdict: "valid", date: "2024-01-10",
  summaryId: "", summaryEn: "", source: "", narration: "Jadwal libur nasional tahun ini.", explanation: "Sesuai SKB tiga menteri.", reference: "", image: "", published: true,
};

const ids = { hoax: 0, wrong: 0, contact: 0 };

beforeAll(async () => {
  await store.saveArticle(article);
  ids.hoax = await reports.addReport({ kind: "report", reportType: "hoax", content: "Bantuan 2 juta rupiah untuk semua warga", platform: "WhatsApp" });
  ids.wrong = await reports.addReport({ kind: "report", reportType: "wrong-result", content: "Jadwal libur nasional tahun ini", detectedVerdict: "Hoax" });
  ids.contact = await reports.addReport({ kind: "contact", firstName: "Ani", email: "ani@example.com", subject: "Halo", message: "Terima kasih untuk situsnya." });
});

describe("columns added this round", () => {
  it("adds note and resolvedSlug to an older database once, and keeps them empty on new reports", async () => {
    const columns = getDb().prepare("PRAGMA table_info(reports)").all().map((c) => String(c.name));
    expect(columns).toEqual(expect.arrayContaining(["note", "resolvedSlug"]));
    expect(columns.filter((c) => c === "note")).toHaveLength(1);
    expect(await reports.getReport(ids.hoax)).toMatchObject({ note: "", resolvedSlug: "", resolvedTitle: "" });
  });
});

describe("notes and resolution", () => {
  it("round-trips a note and a resolved article with its title", async () => {
    await reports.updateReport(ids.wrong, { note: "  Checked against the ministry calendar.  ", resolvedSlug: "jadwal-libur", status: "done" });
    expect(await reports.getReport(ids.wrong)).toMatchObject({
      note: "Checked against the ministry calendar.",
      resolvedSlug: "jadwal-libur",
      resolvedTitle: "[BENAR] Jadwal libur nasional",
      status: "done",
    });
    const listed = (await reports.listReports()).find((r) => r.id === ids.wrong);
    expect(listed?.resolvedTitle).toBe("[BENAR] Jadwal libur nasional");
    expect((await reports.getAllReports()).find((r) => r.id === ids.wrong)?.resolvedTitle).toBe("[BENAR] Jadwal libur nasional");
  });

  it("clears the resolution without touching the note, and names a missing article by its slug", async () => {
    await reports.updateReport(ids.wrong, { resolvedSlug: "" });
    expect(await reports.getReport(ids.wrong)).toMatchObject({ resolvedSlug: "", resolvedTitle: "", note: "Checked against the ministry calendar." });
    await reports.updateReport(ids.wrong, { resolvedSlug: "deleted-later" });
    expect(await reports.getReport(ids.wrong)).toMatchObject({ resolvedSlug: "deleted-later", resolvedTitle: "" });
    await reports.updateReport(ids.wrong, { resolvedSlug: "jadwal-libur" });
  });

  it("caps the note", async () => {
    await reports.updateReport(ids.hoax, { note: "x".repeat(reports.NOTE_MAX + 50) });
    expect((await reports.getReport(ids.hoax))?.note).toHaveLength(reports.NOTE_MAX);
    await reports.updateReport(ids.hoax, { note: "" });
    expect((await reports.getReport(ids.hoax))?.note).toBe("");
  });

  it("looks the archive up for a report and returns nothing for an unknown id", async () => {
    expect(await reports.findSimilarForReport(9999)).toEqual([]);
    expect(Array.isArray(await reports.findSimilarForReport(ids.wrong))).toBe(true);
  });
});

describe("filters and counts", () => {
  it("filters by kind, type, status and unread", async () => {
    expect((await reports.listReports({ kind: "contact" })).map((r) => r.id)).toEqual([ids.contact]);
    expect((await reports.listReports({ type: "wrong-result" })).map((r) => r.id)).toEqual([ids.wrong]);
    expect((await reports.listReports({ status: "done" })).map((r) => r.id)).toEqual([ids.wrong]);
    expect((await reports.listReports()).map((r) => r.id)).toEqual([ids.contact, ids.wrong, ids.hoax]);

    await reports.updateReport(ids.hoax, { read: true });
    expect((await reports.listReports({ unread: true })).map((r) => r.id)).toEqual([ids.contact, ids.wrong]);
    expect((await reports.listReports({ kind: "report", unread: true })).map((r) => r.id)).toEqual([ids.wrong]);
    expect((await reports.listReports({ kind: "report", type: "hoax", status: "new" })).map((r) => r.id)).toEqual([ids.hoax]);
  });

  it("counts per status, for the whole inbox and within a kind", async () => {
    expect(await reports.getReportCounts()).toEqual({ total: 3, unread: 2, byStatus: { new: 2, "in-progress": 0, done: 1 } });
    expect(await reports.getReportCounts({ kind: "contact" })).toEqual({ total: 1, unread: 1, byStatus: { new: 1, "in-progress": 0, done: 0 } });
    expect((await reports.getReportCounts({ kind: "report", type: "wrong-result" })).byStatus.done).toBe(1);
  });
});
