/**
 * Runs once when the server starts. In production it keeps a daily copy of
 * the database: checked every hour, a backup is made when the newest one is
 * more than a day old (see src/lib/backup.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { backupDatabase, keepCount, lastBackupAge } = await import("./lib/backup");
  const { getDb } = await import("./lib/db");
  if (keepCount() === 0) return;

  const DAY = 24 * 60 * 60 * 1000;
  const check = async () => {
    try {
      if (lastBackupAge() < DAY) return;
      const file = await backupDatabase(getDb());
      if (file) console.log(`[backup] database copied to ${file}`);
    } catch (err) {
      console.error("[backup] failed:", err);
    }
  };
  setTimeout(check, 60_000).unref();
  setInterval(check, 60 * 60 * 1000).unref();
}
