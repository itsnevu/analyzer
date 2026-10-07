import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A throwaway database (and backup directory next to it) for this file; set before the libs load.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-system-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.IP2ASN_DIR = dir;
process.env.BASELINE_MODEL_PATH = path.join(dir, "no-model.json");
process.env.SMTP_URL = "smtps://user%40example.com:very-secret-password@smtp.example.com:465";
process.env.REPORT_NOTIFY_EMAIL = "admin@example.com";
process.env.TELEGRAM_BOT_TOKEN = "123:secret-token";
process.env.TELEGRAM_CHAT_ID = "42";
delete process.env.MODEL_API_URL;

const system = await import("@/lib/system");
const store = await import("@/lib/articles");
const { getDb, hasFts } = await import("@/lib/db");

describe("formatting", () => {
  it("formats sizes", () => {
    expect(system.formatBytes(null)).toBe("—");
    expect(system.formatBytes(NaN)).toBe("—");
    expect(system.formatBytes(0)).toBe("0 B");
    expect(system.formatBytes(900)).toBe("900 B");
    expect(system.formatBytes(1536)).toBe("1.5 KB");
    expect(system.formatBytes(12.3 * 1024 * 1024)).toBe("12.3 MB");
    expect(system.formatBytes(250 * 1024 * 1024)).toBe("250 MB");
    expect(system.formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("formats ages and durations", () => {
    expect(system.formatAge(Infinity)).toBe("never");
    expect(system.formatAge(-5)).toBe("just now");
    expect(system.formatAge(30_000)).toBe("just now");
    expect(system.formatAge(5 * 60_000)).toBe("5 min ago");
    expect(system.formatAge(3 * 3_600_000)).toBe("3 h ago");
    expect(system.formatAge(5 * 86_400_000)).toBe("5 d ago");
    expect(system.formatAge(90 * 86_400_000)).toBe("3 mo ago");
    expect(system.formatDuration(45)).toBe("45 s");
    expect(system.formatDuration(5 * 60 + 3)).toBe("5 min");
    expect(system.formatDuration(2 * 3600 + 5 * 60)).toBe("2 h 5 min");
    expect(system.formatDuration(3 * 86_400 + 7 * 3600)).toBe("3 d 7 h");
  });

  it("reads the IPtoASN date from the file name", () => {
    expect(system.ipdbDate("ip2asn-20260930.db")).toBe("2026-09-30");
    expect(system.ipdbDate("/data/ip2asn-20250101.db")).toBe("2025-01-01");
    expect(system.ipdbDate("ip2asn.db")).toBeNull();
    expect(system.ipdbDate(null)).toBeNull();
  });
});

describe("backups", () => {
  it("lists dated backups newest first and ignores other files", () => {
    const bdir = fs.mkdtempSync(path.join(dir, "bk-"));
    fs.writeFileSync(path.join(bdir, "hoax-20260101-120000.db"), "a".repeat(10));
    fs.writeFileSync(path.join(bdir, "hoax-20260302-083000.db"), "b".repeat(25));
    fs.writeFileSync(path.join(bdir, "notes.txt"), "x");
    fs.writeFileSync(path.join(bdir, "hoax-latest.db"), "x");
    const now = Date.UTC(2026, 2, 2, 9, 30, 0);
    const files = system.listBackups(bdir, now);
    expect(files.map((f) => f.name)).toEqual(["hoax-20260302-083000.db", "hoax-20260101-120000.db"]);
    expect(files[0]).toMatchObject({ bytes: 25, at: "2026-03-02T08:30:00Z", ageMs: 3_600_000 });
    expect(files[1].bytes).toBe(10);
    expect(system.listBackups(path.join(dir, "does-not-exist"))).toEqual([]);
  });

  it("reports free disk space as a number or null", () => {
    const free = system.freeDiskBytes(dir);
    expect(free === null || (typeof free === "number" && free > 0)).toBe(true);
  });

  it("writes a backup on demand and sees it in the listing", async () => {
    await store.listArticles(); // creates and seeds the database
    const made = await system.runBackup();
    expect(made.name).toMatch(/^hoax-\d{8}-\d{6}\.db$/);
    expect(made.bytes).toBeGreaterThan(0);
    const info = system.backupsInfo();
    expect(info.dir).toBe(path.join(dir, "backup"));
    expect(info.files.map((f) => f.name)).toContain(made.name);
    expect(info.lastAgeMs).toBeLessThan(60_000);
    expect(info.totalBytes).toBeGreaterThanOrEqual(made.bytes);
  });
});

describe("database and maintenance", () => {
  it("describes the database file and counts the tables", () => {
    const db = system.databaseInfo();
    expect(db.file).toBe(process.env.DATABASE_PATH);
    expect(db.bytes).toBeGreaterThan(0);
    expect(db.journalMode).toBe("wal");
    expect(db.pageSize).toBeGreaterThan(0);
    expect(db.schemaVersion).toBeGreaterThanOrEqual(6);
    expect(db.fts).toBe(hasFts());
    expect(db.counts.articles).toBeGreaterThan(0);
    expect(db.counts.reports).toBe(0);
    expect(db.counts.admin_log).toBe(0);
    expect(db.counts.legacy_dataset).toBe(0); // panel tables are created on demand
  });

  it("rebuilds the search index and optimizes the file", () => {
    if (hasFts()) {
      const r = system.rebuildSearchIndex();
      expect(r.rows).toBeGreaterThan(0);
      expect(r.ms).toBeGreaterThanOrEqual(0);
    } else {
      expect(() => system.rebuildSearchIndex()).toThrow(/not available/);
    }
    const o = system.optimizeDatabase();
    expect(o.vacuumed).toBe(true);
    expect(o.afterBytes).toBeGreaterThan(0);
    // A huge WAL threshold of zero skips the VACUUM when anything is in the log.
    getDb().prepare("INSERT INTO reports (firstName, email, subject, message) VALUES ('a', 'a@b.c', 's', 'm')").run();
    expect(system.optimizeDatabase(-1).vacuumed).toBe(false);
  });

  it("purges nothing when retention is unlimited and otherwise defers to the research log", () => {
    process.env.RESEARCH_IP_RETENTION_DAYS = "0";
    expect(system.purgeIpsNow()).toEqual({ purged: 0, retentionDays: 0 });
    process.env.RESEARCH_IP_RETENTION_DAYS = "30";
    expect(system.purgeIpsNow()).toEqual({ purged: 0, retentionDays: 30 });
  });
});

describe("configuration and files", () => {
  it("never exposes secrets", () => {
    const cfg = system.configInfo();
    expect(cfg.smtp).toEqual({ configured: true, host: "smtp.example.com" });
    expect(cfg.telegram).toBe(true);
    expect(cfg.reportEmail).toBe("admin@example.com");
    expect(cfg.externalModel.configured).toBe(false);
    expect(cfg.auth.problem).toBeNull();
    const json = JSON.stringify(cfg);
    expect(json).not.toContain("very-secret-password");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("user%40example.com");
  });

  it("reports the data files", () => {
    fs.writeFileSync(path.join(dir, "ip2asn-20260930.db"), "stub");
    const f = system.filesInfo();
    expect(f.model).toMatchObject({ present: false, bytes: null, trainedAt: null });
    expect(f.ipdb).toMatchObject({ file: "ip2asn-20260930.db", date: "2026-09-30", bytes: 4 });
    expect(typeof f.ocr.present).toBe("boolean");
    expect(Array.isArray(f.ocr.languages)).toBe(true);
  });

  it("describes the runtime", () => {
    const rt = system.runtimeInfo();
    expect(rt.node).toBe(process.version);
    expect(rt.next).toMatch(/^\d+\.\d+\.\d+/);
    expect(rt.rssBytes).toBeGreaterThan(0);
    expect(rt.cpus).toBeGreaterThan(0);
  });
});
