import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ipToBytes } from "@/lib/ip-asn";
import { parseUserAgent } from "@/lib/user-agent";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-usage-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.IP2ASN_DIR = dir; // no network database: lookups return nothing
const usage = await import("@/lib/usage");
const { getDb } = await import("@/lib/db");

const req = (ua = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36") =>
  new Request("http://localhost/api/detect", { headers: { "cf-connecting-ip": "36.68.1.1", "x-forwarded-for": "10.0.0.1", "user-agent": ua } });

describe("addresses and devices", () => {
  it("orders IPv4 and IPv6 in one keyspace", () => {
    expect(ipToBytes("1.2.3.4")?.toString("hex")).toBe("00000000000000000000ffff01020304");
    expect(ipToBytes("::ffff:1.2.3.4")?.toString("hex")).toBe("00000000000000000000ffff01020304");
    expect(ipToBytes("2001:db8::1")?.toString("hex")).toBe("20010db8000000000000000000000001");
    expect(ipToBytes("not an ip")).toBeNull();
  });

  it("reads coarse device facts", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]")).toMatchObject({ device: "mobile", os: "iOS", inApp: "Facebook" });
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130")).toMatchObject({ device: "desktop", os: "Windows", browser: "Edge" });
    expect(parseUserAgent("python-requests/2.31").device).toBe("script");
  });
});

describe("research log", () => {
  it("records a check with network, device and sanitized meta", () => {
    const meta = usage.readClientMeta({ visitor: "abc123", role: "journalist", organization: "Tribun Jateng", via: "paste", evil: "x" });
    const id = usage.recordUsage(req(), "check", meta, { text: "cek ini", verdict: "hoax" })!;
    const row = getDb().prepare("SELECT * FROM usage_log WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ kind: "check", ip: "36.68.1.1", device: "mobile", os: "Android", role: "journalist", organization: "Tribun Jateng", via: "paste", verdict: "hoax" });
    expect(String(row.ipHash)).toHaveLength(16);
    expect(usage.readClientMeta({ role: "hacker" }).role).toBe("");
  });

  it("labels a check with a role only from the same browser", () => {
    const id = usage.recordUsage(req(), "check", usage.readClientMeta({ visitor: "v1" }))!;
    usage.attachProfile(id, "other", "student", "");
    usage.attachProfile(id, "v1", "teacher", "SMA 1");
    expect(getDb().prepare("SELECT role FROM usage_log WHERE id = ?").get(id)).toMatchObject({ role: "teacher" });
  });

  it("clears old IP addresses and scrambles their hash, keeping rows cleared together groupable", () => {
    const a = usage.recordUsage(req(), "visit", usage.readClientMeta({}))!;
    const b = usage.recordUsage(req(), "visit", usage.readClientMeta({}))!;
    const legacy = usage.recordUsage(req(), "visit", usage.readClientMeta({}))!;
    getDb().prepare("UPDATE usage_log SET recordedAt = datetime('now', '-400 days') WHERE id IN (?, ?)").run(a, b);
    // An imported row: recorded today, but the visit itself was years ago.
    getDb().prepare("UPDATE usage_log SET at = '2019-05-01T10:00:00.000Z' WHERE id = ?").run(legacy);
    const original = usage.ipHash("36.68.1.1");
    expect(usage.purgeExpiredIps(365)).toBeGreaterThanOrEqual(3);
    const rows = getDb().prepare("SELECT ip, ipHash FROM usage_log WHERE id IN (?, ?, ?) ORDER BY id").all(a, b, legacy) as { ip: string | null; ipHash: string }[];
    for (const r of rows) {
      expect(r.ip).toBeNull();
      expect(r.ipHash).not.toBe("");
      expect(r.ipHash).not.toBe(original);
    }
    expect(rows[0].ipHash).toBe(rows[1].ipHash);
  });

  it("exports anonymized CSV without IP addresses, report text, organization or full referrers", () => {
    usage.recordUsage(req(), "contact", usage.readClientMeta({ organization: "Kantor Berita X", referrer: "https://www.facebook.com/groups/abc?fbclid=secret" }), { text: "Nama saya Budi, 0812-3456" });
    const csv = [...usage.usageCsv({ staff: true }, true)].join("");
    expect(csv).not.toContain("36.68.1.1");
    expect(csv.split("\n")[0]).not.toMatch(/,ip,|,organization,|,reportId,/);
    expect(csv).not.toContain("Budi");
    expect(csv).not.toContain("fbclid");
    expect(csv).toContain("www.facebook.com");
    expect(csv).not.toContain(usage.ipHash("36.68.1.1"));
    expect([...usage.usageCsv({ staff: true }, false)].join("")).toContain("36.68.1.1");
  });
});
