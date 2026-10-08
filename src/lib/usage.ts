import { createHmac, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { ipHash, networkOf } from "./ip-asn";

export { ipHash, networkOf };
import { clientIp } from "./rate-limit";
import { parseUserAgent } from "./user-agent";
import { csvCell } from "./csv";

/**
 * Research log of how the site is used: every visit, check, report and message,
 * with the visitor's IP address, network, device and (if they say) role. The
 * privacy page (/privacy) describes exactly this; change both together.
 * IP addresses are cleared after RESEARCH_IP_RETENTION_DAYS (default 365, 0 = keep).
 * Server-only.
 */

export type UsageKind = "visit" | "check" | "report" | "contact" | "profile";

export const ROLES = ["journalist", "fact-checker", "student", "teacher", "researcher", "government", "community", "public", "other"] as const;

/** What the browser sends along (see usage-client.ts); all optional and self-reported. */
export interface ClientMeta {
  visitor: string;
  session: string;
  referrer: string;
  utm: string;
  path: string;
  timezone: string;
  language: string;
  screen: string;
  installed: number;
  via: string;
  role: string;
  organization: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

export function readClientMeta(raw: unknown): ClientMeta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const role = str(m.role, 20);
  return {
    visitor: str(m.visitor, 40).replace(/[^\w-]/g, ""),
    session: str(m.session, 40).replace(/[^\w-]/g, ""),
    referrer: str(m.referrer, 500),
    utm: str(m.utm, 300),
    path: str(m.path, 200),
    timezone: str(m.timezone, 60),
    language: str(m.language, 40),
    screen: str(m.screen, 20),
    installed: m.installed ? 1 : 0,
    via: str(m.via, 20),
    role: (ROLES as readonly string[]).includes(role) ? role : "",
    organization: str(m.organization, 120),
  };
}

export type UsageFields = Partial<{
  text: string; url: string; pageTitle: string; input: string; lang: string; verdict: string; probability: number;
  engine: string; matches: number; topMatch: string; ms: number; error: string; reportId: number;
}>;

const COLUMNS = [
  "at", "origin", "legacyId", "kind", "staff", "visitor", "session", "ip", "ipHash", "asn", "asOrg", "country",
  "userAgent", "device", "os", "browser", "inApp", "language", "timezone", "screen", "installed", "referrer", "utm", "path",
  "via", "input", "text", "url", "pageTitle", "lang", "verdict", "probability", "engine", "matches", "topMatch", "ms",
  "error", "role", "organization", "reportId",
] as const;

export type UsageRow = Partial<Record<(typeof COLUMNS)[number], string | number | null>>;

export function insertUsage(row: UsageRow): number {
  const cols = COLUMNS.filter((c) => row[c] !== undefined);
  const r = getDb()
    .prepare(`INSERT OR IGNORE INTO usage_log (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .run(...cols.map((c) => row[c] ?? null));
  return Number(r.lastInsertRowid);
}

/** Logs one use of the site; never throws, so logging can't break the feature it records. */
export function recordUsage(req: Request, kind: UsageKind, meta: ClientMeta, fields: UsageFields = {}, staff = false): number | null {
  try {
    const raw = clientIp(req);
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
    return insertUsage({
      at: new Date().toISOString(),
      kind,
      staff: staff ? 1 : 0,
      ...networkOf(raw === "local" ? null : raw),
      userAgent: ua,
      ...parseUserAgent(ua),
      language: meta.language || (req.headers.get("accept-language") ?? "").split(",")[0].slice(0, 40),
      ...Object.fromEntries(Object.entries(meta).filter(([k]) => k !== "language")),
      ...fields,
      text: (fields.text ?? "").slice(0, 20_000),
    });
  } catch (err) {
    console.error("[usage] could not record:", err);
    return null;
  }
}

/** A role given after a check also labels that check, if it came from the same browser. */
export function attachProfile(checkId: number, visitor: string, role: string, organization: string): void {
  if (!visitor) return;
  getDb().prepare("UPDATE usage_log SET role = ?, organization = ? WHERE id = ? AND visitor = ?").run(role, organization, checkId, visitor);
}

export function retentionDays(): number {
  const n = Number(process.env.RESEARCH_IP_RETENTION_DAYS ?? 365);
  return Number.isFinite(n) && n >= 0 ? n : 365;
}

/**
 * Clears IP addresses older than `days`, counted from the visit itself or from
 * when it was recorded, whichever is earlier (imported legacy rows were recorded
 * years after the visit). The network name and country stay. The address hash
 * is re-keyed with a random key that is discarded, so rows cleared together can
 * still be counted as one address but can no longer be traced back to it.
 */
export function purgeExpiredIps(days = retentionDays()): number {
  if (days === 0) return 0;
  const db = getDb();
  const cutoff = `-${days} days`;
  const rows = db
    .prepare("SELECT id, ipHash FROM usage_log WHERE ip IS NOT NULL AND (recordedAt < datetime('now', ?) OR datetime(at) < datetime('now', ?))")
    .all(cutoff, cutoff) as { id: number; ipHash: string }[];
  if (!rows.length) return 0;
  const throwaway = randomBytes(32);
  const update = db.prepare("UPDATE usage_log SET ip = NULL, ipHash = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    for (const r of rows) update.run(r.ipHash ? createHmac("sha256", throwaway).update(r.ipHash).digest("hex").slice(0, 16) : "", r.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return rows.length;
}

/* ---------------------------------------------------------------- reports */

export interface UsageFilter {
  from?: string;
  to?: string;
  origin?: "site" | "legacy" | "";
  staff?: boolean;
}

function where(f: UsageFilter, extra = ""): { sql: string; args: string[] } {
  const parts: string[] = [];
  const args: string[] = [];
  const add = (sql: string, arg: string) => {
    parts.push(sql);
    args.push(arg);
  };
  if (f.from) add("at >= ?", f.from);
  if (f.to) add("at < date(?, '+1 day')", f.to);
  if (f.origin) add("origin = ?", f.origin);
  if (!f.staff) parts.push("staff = 0");
  if (extra) parts.push(extra);
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", args };
}

export const BREAKDOWNS = {
  asOrg: "Network (internet provider or organization)",
  organization: "Organization (self-reported)",
  role: "Role (self-reported)",
  country: "Country",
  device: "Device",
  os: "Operating system",
  browser: "Browser",
  inApp: "Opened inside an app",
  via: "How the text was entered",
  input: "Input",
  referrer: "Came from",
  timezone: "Time zone",
  verdict: "Verdict",
  engine: "Engine",
} as const;
export type Breakdown = keyof typeof BREAKDOWNS;

export function countBy(column: Breakdown, f: UsageFilter, kind = "check", limit = 12): { value: string; count: number }[] {
  const col = column === "referrer" ? "substr(referrer, instr(referrer, '//') + 2, instr(substr(referrer, instr(referrer, '//') + 2) || '/', '/') - 1)" : column;
  const w = where(f, `kind = '${kind}'`);
  return getDb()
    .prepare(`SELECT ${col} AS value, COUNT(*) AS count FROM usage_log ${w.sql} GROUP BY value HAVING value != '' ORDER BY count DESC LIMIT ${limit}`)
    .all(...w.args).map((r) => ({ ...r })) as { value: string; count: number }[];
}

export function usageTotals(f: UsageFilter) {
  const w = where(f);
  return getDb()
    .prepare(
      `SELECT SUM(kind = 'check') AS checks, SUM(kind = 'visit') AS visits, SUM(kind IN ('report', 'contact')) AS reports,
              COUNT(DISTINCT CASE WHEN visitor != '' THEN visitor END) AS visitors,
              COUNT(DISTINCT CASE WHEN ipHash != '' THEN ipHash END) AS networks,
              SUM(ip IS NOT NULL) AS withIp, MIN(at) AS first, MAX(at) AS last
       FROM usage_log ${w.sql}`,
    )
    .get(...w.args) as Record<string, number | string | null>;
}

export function checksByMonth(f: UsageFilter) {
  const w = where(f, "kind = 'check'");
  return getDb()
    .prepare(`SELECT substr(at, 1, 7) AS month, COUNT(*) AS count, SUM(input = 'link') AS links FROM usage_log ${w.sql} GROUP BY month ORDER BY month`)
    .all(...w.args).map((r) => ({ ...r })) as { month: string; count: number; links: number }[];
}

/** Checks per hour of the day, Western Indonesian Time (UTC+7). */
export function checksByHour(f: UsageFilter): number[] {
  const w = where(f, "kind = 'check'");
  const rows = getDb()
    .prepare(`SELECT CAST(strftime('%H', at, '+7 hours') AS INTEGER) AS h, COUNT(*) AS n FROM usage_log ${w.sql} GROUP BY h`)
    .all(...w.args) as { h: number; n: number }[];
  const out = Array<number>(24).fill(0);
  for (const r of rows) out[r.h] = r.n;
  return out;
}

export function recentUsage(f: UsageFilter, limit = 50) {
  const w = where(f);
  return getDb()
    .prepare(
      `SELECT id, at, origin, kind, visitor, ip, asOrg, country, device, os, browser, inApp, via, role, organization,
              substr(text, 1, 140) AS text, verdict, error FROM usage_log ${w.sql} ORDER BY at DESC, id DESC LIMIT ${limit}`,
    )
    .all(...w.args).map((r) => ({ ...r })) as Record<string, string | number | null>[];
}

// Left out of the anonymized export: direct identifiers, free text that can name a person, and the link to a report's contact details.
const PRIVATE_COLUMNS = new Set(["ip", "userAgent", "organization", "reportId", "legacyId"]);

/** "https://www.facebook.com/groups/x?fbclid=..." becomes "www.facebook.com"; other values pass through. */
function referrerHost(v: unknown): unknown {
  if (typeof v !== "string" || !v) return v;
  try {
    return new URL(v).host;
  } catch {
    return "";
  }
}

/**
 * CSV of the log. Anonymized: no IP, raw User-Agent, organization or report
 * link; referrers cut to their host; the text of reports and contact messages
 * left out; the address and browser hashes re-keyed with a key made for this
 * export alone, so rows can still be grouped within the file but not matched
 * to the database or to another export.
 */
export function* usageCsv(f: UsageFilter, anonymized: boolean): Generator<string> {
  const cols = ["id", "recordedAt", ...COLUMNS].filter((c) => !(anonymized && PRIVATE_COLUMNS.has(c)));
  const cell = csvCell;
  const exportKey = randomBytes(32);
  const rekey = (v: unknown) => (v ? createHmac("sha256", exportKey).update(String(v)).digest("hex").slice(0, 16) : "");
  yield "﻿" + cols.join(",") + "\n";
  const w = where(f);
  for (const row of getDb().prepare(`SELECT * FROM usage_log ${w.sql} ORDER BY at, id`).iterate(...w.args) as Iterable<Record<string, unknown>>) {
    if (anonymized) {
      row.visitor = rekey(row.visitor && `v:${row.visitor}`);
      row.session = rekey(row.session && `s:${row.session}`);
      row.ipHash = rekey(row.ipHash);
      row.referrer = referrerHost(row.referrer);
      if (row.kind === "report" || row.kind === "contact") row.text = "";
    }
    yield cols.map((c) => cell(row[c])).join(",") + "\n";
  }
}
