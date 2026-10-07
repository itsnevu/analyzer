import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A throwaway database for this file; set before the lib is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-admin-log-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const log = await import("@/lib/admin-log");
const { getDb } = await import("@/lib/db");

const req = (ip = "36.68.1.1") => new Request("http://localhost/api/admin/articles", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

describe("writing", () => {
  it("records the action with the caller's address and clips long values", () => {
    log.logAdmin(req(), "article.create", "vaksin-magnet", "x".repeat(3000));
    const row = getDb().prepare("SELECT * FROM admin_log ORDER BY id DESC LIMIT 1").get() as Record<string, unknown>;
    expect(row).toMatchObject({ action: "article.create", target: "vaksin-magnet", ip: "36.68.1.1" });
    expect(String(row.detail)).toHaveLength(2000);
    expect(String(row.at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("works without a request and never throws", () => {
    expect(() => log.logAdmin(null, "system.backup", "hoax-20260101-000000.db")).not.toThrow();
    expect(() => log.logAdmin({} as Request, "login")).not.toThrow();
    expect(() => log.logAdmin(req(), "", { not: "a string" }, 42)).not.toThrow();
    const rows = getDb().prepare("SELECT action, target, detail, ip FROM admin_log ORDER BY id DESC LIMIT 3").all() as Record<string, string>[];
    expect(rows[0]).toMatchObject({ action: "unknown", target: "[object Object]", detail: "42" });
    expect(rows[1]).toMatchObject({ action: "login", ip: "" });
    expect(rows[2]).toMatchObject({ action: "system.backup", ip: "" });
  });
});

describe("reading", () => {
  it("lists newest first, filters by action and date, and pages", () => {
    const db = getDb();
    db.exec("DELETE FROM admin_log");
    for (let i = 0; i < 7; i++) log.logAdmin(req(), i % 2 ? "login" : "article.update", `a-${i}`);
    db.prepare("UPDATE admin_log SET at = '2024-03-10T08:00:00.000Z' WHERE target = 'a-0'").run();
    db.prepare("UPDATE admin_log SET at = '2024-03-12T23:59:59.000Z' WHERE target = 'a-1'").run();

    const all = log.listAdminLog();
    expect(all.total).toBe(7);
    expect(all.items.map((r) => r.target)).toEqual(["a-6", "a-5", "a-4", "a-3", "a-2", "a-1", "a-0"]);
    expect(all.items[0]).not.toHaveProperty("secret");
    expect(Object.getPrototypeOf(all.items[0])).toBe(Object.prototype);

    const logins = log.listAdminLog({ action: "login" });
    expect(logins.total).toBe(3);
    expect(logins.items.every((r) => r.action === "login")).toBe(true);

    expect(log.listAdminLog({ from: "2024-03-01", to: "2024-03-12" }).items.map((r) => r.target)).toEqual(["a-1", "a-0"]);
    expect(log.listAdminLog({ to: "2024-03-11" }).items.map((r) => r.target)).toEqual(["a-0"]);
    expect(log.listAdminLog({ from: "not a date" }).total).toBe(7);

    const page = log.listAdminLog({ pageSize: 3, page: 3 });
    expect(page).toMatchObject({ page: 3, pages: 3, pageSize: 3 });
    expect(page.items.map((r) => r.target)).toEqual(["a-0"]);
    expect(log.listAdminLog({ pageSize: 3, page: 99 }).page).toBe(3);
  });

  it("knows which actions occur and labels them", () => {
    expect(log.adminLogActions()).toEqual([
      { action: "article.update", count: 4 },
      { action: "login", count: 3 },
    ]);
    expect(log.actionLabel("login")).toBe("Logged in");
    expect(log.actionLabel("made.up")).toBe("made.up");
  });

  it("reads the filter from query parameters", () => {
    const f = log.adminLogFilterFrom((k) => ({ action: " login ", from: "2024-01-01", to: "junk", page: "2" })[k]);
    expect(f).toEqual({ action: "login", from: "2024-01-01", to: undefined, page: 2 });
  });

  it("exports CSV oldest first with a label column", () => {
    const csv = [...log.adminLogCsv({ action: "login" })].join("");
    // trimEnd, not trim: trim() would also drop the byte-order mark that makes Excel read the file as UTF-8.
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("﻿id,at,action,label,target,detail,ip");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain(",login,Logged in,a-1,");
    expect(lines[3]).toContain(",a-5,");
    expect(lines[1]).toContain("36.68.1.1");
  });
});

describe("clearing", () => {
  it("deletes only entries older than the given days", () => {
    const db = getDb();
    db.exec("DELETE FROM admin_log");
    log.logAdmin(req(), "login", "recent");
    log.logAdmin(req(), "login", "old");
    const old = new Date(Date.now() - 100 * 86_400_000).toISOString();
    db.prepare("UPDATE admin_log SET at = ? WHERE target = 'old'").run(old);
    expect(log.clearAdminLog(90)).toBe(1);
    expect(log.listAdminLog().items.map((r) => r.target)).toEqual(["recent"]);
    expect(log.clearAdminLog(0)).toBe(0); // at least one day is kept
    expect(log.listAdminLog().total).toBe(1);
  });
});
