import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nextPkg from "next/package.json";
import { authConfigProblem, usingDevDefaults } from "./auth";
import { backupDatabase, backupDir, databaseFile, keepCount, lastBackupAge } from "./backup";
import { baselineInfo, baselineModelPath, modelStatus } from "./baseline";
import { getDb, hasFts, SCHEMA_VERSION } from "./db";
import { IPDB_DIR } from "./ip-asn";
import { panelDb } from "./legacy-panel";
import { SITE_URL } from "./site";
import { purgeExpiredIps, retentionDays } from "./usage";

/**
 * What the /admin/system page shows and does: runtime, database, backups,
 * configuration (which optional features are set, never their secrets), data
 * files, and the maintenance actions. Server-only.
 */

/* ------------------------------------------------------------- helpers */

/** "12.3 MB"; null or NaN → "—". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** "3 h ago"; Infinity → "never"; a negative or tiny span → "just now". */
export function formatAge(ms: number): string {
  if (!Number.isFinite(ms)) return "never";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} d ago`;
  return `${Math.round(d / 30)} mo ago`;
}

/** "2 d 3 h" for an uptime in seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min`;
  return `${s} s`;
}

function sizeOf(file: string): number | null {
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- runtime */

export interface RuntimeInfo {
  node: string;
  next: string;
  env: string;
  uptimeSeconds: number;
  rssBytes: number;
  heapUsedBytes: number;
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalMemoryBytes: number;
  pid: number;
}

export function runtimeInfo(): RuntimeInfo {
  const mem = process.memoryUsage();
  return {
    node: process.version,
    next: nextPkg.version,
    env: process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.round(process.uptime()),
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    platform: `${os.type()} ${os.release()}`,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    pid: process.pid,
  };
}

/* ------------------------------------------------------------ database */

/** Tables counted on the page, in display order. The panel tables exist once panelDb() has run. */
export const COUNTED_TABLES = ["articles", "reports", "usage_log", "searches", "legacy_dataset", "stopwords", "admin_log"] as const;

export interface DatabaseInfo {
  file: string;
  bytes: number | null;
  walBytes: number | null;
  journalMode: string;
  pageSize: number;
  pageCount: number;
  /** pages on the free list, i.e. space VACUUM would give back */
  freePages: number;
  counts: Record<(typeof COUNTED_TABLES)[number], number | null>;
  fts: boolean;
  schemaVersion: number;
}

export function walFile(file = databaseFile()): string {
  return `${file}-wal`;
}

export function databaseInfo(): DatabaseInfo {
  const db = panelDb();
  const file = databaseFile();
  const pragma = (name: string) => Object.values(db.prepare(`PRAGMA ${name}`).get() ?? {})[0];
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));
  const counts = Object.fromEntries(
    COUNTED_TABLES.map((t) => [t, tables.has(t) ? Number((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n) : null]),
  ) as DatabaseInfo["counts"];
  return {
    file,
    bytes: sizeOf(file),
    walBytes: sizeOf(walFile(file)) ?? 0,
    journalMode: String(pragma("journal_mode") ?? ""),
    pageSize: Number(pragma("page_size") ?? 0),
    pageCount: Number(pragma("page_count") ?? 0),
    freePages: Number(pragma("freelist_count") ?? 0),
    counts,
    fts: hasFts(),
    schemaVersion: SCHEMA_VERSION,
  };
}

/* ------------------------------------------------------------- backups */

const BACKUP_NAME = /^hoax-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/;

export interface BackupFile {
  name: string;
  bytes: number;
  /** ISO time from the file name (UTC) */
  at: string;
  ageMs: number;
}

/** Dated backups in `dir`, newest first; an unreadable or missing directory gives []. */
export function listBackups(dir = backupDir(), now = Date.now()): BackupFile[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: BackupFile[] = [];
  for (const name of names) {
    const m = BACKUP_NAME.exec(name);
    if (!m) continue;
    const at = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
    const stamp = new Date(at).getTime();
    out.push({ name, bytes: sizeOf(path.join(dir, name)) ?? 0, at, ageMs: Number.isNaN(stamp) ? 0 : now - stamp });
  }
  return out.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

/** Bytes free for this process on the volume holding `dir`; null when the OS does not say. */
export function freeDiskBytes(dir: string): number | null {
  try {
    const s = fs.statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

export interface BackupsInfo {
  dir: string;
  keep: number;
  files: BackupFile[];
  totalBytes: number;
  /** ms since the newest backup; Infinity when there is none */
  lastAgeMs: number;
  freeDiskBytes: number | null;
}

export function backupsInfo(): BackupsInfo {
  const dir = backupDir();
  const files = listBackups(dir);
  return {
    dir,
    keep: keepCount(),
    files,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
    lastAgeMs: lastBackupAge(),
    freeDiskBytes: freeDiskBytes(path.dirname(databaseFile())),
  };
}

/* ------------------------------------------------------- configuration */

export interface ConfigInfo {
  externalModel: { configured: boolean; host: string | null; timeoutMs: number };
  telegram: boolean;
  smtp: { configured: boolean; host: string | null };
  reportEmail: string;
  ipRetentionDays: number;
  siteUrl: string;
  backupKeep: number;
  databasePathSet: boolean;
  auth: { production: boolean; problem: string | null; devDefaults: boolean };
}

/** Which optional features are set. Hosts only; no token, password or key ever leaves this function. */
export function configInfo(): ConfigInfo {
  let smtpHost: string | null = null;
  if (process.env.SMTP_URL) {
    try {
      smtpHost = new URL(process.env.SMTP_URL).hostname || "(set)";
    } catch {
      smtpHost = "(set)";
    }
  }
  return {
    externalModel: modelStatus().external,
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    smtp: { configured: !!process.env.SMTP_URL, host: smtpHost },
    reportEmail: process.env.REPORT_NOTIFY_EMAIL ?? "",
    ipRetentionDays: retentionDays(),
    siteUrl: SITE_URL,
    backupKeep: keepCount(),
    databasePathSet: !!process.env.DATABASE_PATH,
    auth: { production: process.env.NODE_ENV === "production", problem: authConfigProblem(), devDefaults: usingDevDefaults() },
  };
}

/* --------------------------------------------------------------- files */

export interface FilesInfo {
  ocr: { dir: string; present: boolean; languages: string[] };
  model: { path: string; present: boolean; bytes: number | null; trainedAt: string | null; docs: number | null };
  ipdb: { dir: string; file: string | null; date: string | null; bytes: number | null };
}

/** "ip2asn-20260930.db" → "2026-09-30"; anything else → null. */
export function ipdbDate(name: string | null | undefined): string | null {
  const m = name ? /^ip2asn-(\d{4})(\d{2})(\d{2})\.db$/.exec(path.basename(name)) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function filesInfo(): FilesInfo {
  const ocrDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "ocr");
  let languages: string[] = [];
  try {
    languages = fs
      .readdirSync(path.join(ocrDir, "lang"))
      .filter((f) => /\.traineddata(\.gz)?$/.test(f))
      .map((f) => f.replace(/\.traineddata(\.gz)?$/, ""))
      .sort();
  } catch {
    languages = [];
  }
  const ocrPresent = fs.existsSync(path.join(ocrDir, "worker.min.js")) && languages.length > 0;

  const modelPath = baselineModelPath();
  const modelBytes = sizeOf(modelPath);
  const info = modelBytes === null ? null : baselineInfo();

  const ipDir = IPDB_DIR();
  let ipFile: string | null = null;
  try {
    ipFile = fs.readdirSync(ipDir).filter((f) => /^ip2asn-\d{8}\.db$/.test(f)).sort().pop() ?? null;
  } catch {
    ipFile = null;
  }

  return {
    ocr: { dir: ocrDir, present: ocrPresent, languages },
    model: { path: modelPath, present: modelBytes !== null, bytes: modelBytes, trainedAt: info?.trainedAt ?? null, docs: info?.docs ?? null },
    ipdb: { dir: ipDir, file: ipFile, date: ipdbDate(ipFile), bytes: ipFile ? sizeOf(path.join(/* turbopackIgnore: true */ ipDir, ipFile)) : null },
  };
}

/* --------------------------------------------------------- maintenance */

export const SYSTEM_ACTIONS = ["backup", "purge-ips", "rebuild-index", "optimize", "revoke-sessions"] as const;
export type SystemAction = (typeof SYSTEM_ACTIONS)[number];

export function isSystemAction(v: unknown): v is SystemAction {
  return (SYSTEM_ACTIONS as readonly unknown[]).includes(v);
}

/** A backup now, whatever DB_BACKUP_KEEP says (0 still keeps this one). */
export async function runBackup(): Promise<{ file: string; name: string; bytes: number }> {
  const file = await backupDatabase(getDb(), Math.max(keepCount(), 1));
  if (!file) throw new Error("The backup was not written.");
  return { file, name: path.basename(file), bytes: sizeOf(file) ?? 0 };
}

export function purgeIpsNow(): { purged: number; retentionDays: number } {
  const days = retentionDays();
  return { purged: days === 0 ? 0 : purgeExpiredIps(days), retentionDays: days };
}

/** Rebuilds articles_fts from the articles table. */
export function rebuildSearchIndex(): { ms: number; rows: number } {
  if (!hasFts()) throw new Error("Full-text search is not available in this Node build.");
  const db = getDb();
  const started = performance.now();
  db.exec("INSERT INTO articles_fts (articles_fts) VALUES ('rebuild')");
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
  return { ms: Math.round(performance.now() - started), rows: Number(n) };
}

/** VACUUM is skipped while the WAL is larger than this after a checkpoint (busy readers). */
export const VACUUM_MAX_WAL_BYTES = 64 * 1024 * 1024;

export interface OptimizeResult {
  vacuumed: boolean;
  beforeBytes: number;
  afterBytes: number;
  walBytes: number;
  ms: number;
}

/**
 * PRAGMA optimize (query planner statistics), a WAL checkpoint, then VACUUM
 * when the WAL is small enough. Rewrites the whole file: a few seconds on the
 * real archive, during which writes wait.
 */
export function optimizeDatabase(maxWalBytes = VACUUM_MAX_WAL_BYTES): OptimizeResult {
  const db = getDb();
  const file = databaseFile();
  const started = performance.now();
  const beforeBytes = sizeOf(file) ?? 0;
  db.exec("PRAGMA optimize");
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    /* another connection holds the WAL; VACUUM decides below */
  }
  const walBytes = sizeOf(walFile(file)) ?? 0;
  const vacuumed = walBytes <= maxWalBytes;
  if (vacuumed) db.exec("VACUUM");
  return { vacuumed, beforeBytes, afterBytes: sizeOf(file) ?? beforeBytes, walBytes, ms: Math.round(performance.now() - started) };
}
