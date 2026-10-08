import fs from "node:fs";
import path from "node:path";
import { backup, type DatabaseSync } from "node:sqlite";

/**
 * Consistent copies of the SQLite database (SQLite's online backup, safe while
 * the site is running). Used by the daily job in src/instrumentation.ts and by
 * `npm run db:backup`. Imports only Node built-ins so plain scripts can use it.
 */

const NAME = /^hoax-\d{8}-\d{6}\.db$/;

export function databaseFile(): string {
  return process.env.DATABASE_PATH ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "hoax.db");
}

export function backupDir(): string {
  return path.join(/* turbopackIgnore: true */ path.dirname(databaseFile()), "backup");
}

/** How many dated backups to keep (DB_BACKUP_KEEP, default 14); 0 turns backups off. */
export function keepCount(): number {
  const n = Number(process.env.DB_BACKUP_KEEP ?? 14);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 14;
}

function dated(): string[] {
  const dir = backupDir();
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => NAME.test(f)).sort() : [];
}

/** Milliseconds since the newest dated backup, or Infinity when there is none. */
export function lastBackupAge(): number {
  const newest = dated().pop();
  return newest ? Date.now() - fs.statSync(path.join(/* turbopackIgnore: true */ backupDir(), newest)).mtimeMs : Infinity;
}

/** Writes data/backup/hoax-YYYYMMDD-HHMMSS.db and deletes the oldest beyond the keep count. */
export async function backupDatabase(db: DatabaseSync, keep = keepCount()): Promise<string | null> {
  if (keep <= 0) return null;
  fs.mkdirSync(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const file = path.join(/* turbopackIgnore: true */ backupDir(), `hoax-${stamp}.db`);
  await backup(db, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows */
  }
  const all = dated();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(/* turbopackIgnore: true */ backupDir(), old), { force: true });
  return file;
}
