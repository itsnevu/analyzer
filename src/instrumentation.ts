/**
 * Runs once when the server starts. In production it keeps a daily copy of
 * the database: checked every hour, a backup is made when the newest one is
 * more than a day old (see src/lib/backup.ts). The same hourly check clears
 * research-log IP addresses past their retention period (src/lib/usage.ts)
 * and retrains the classifier once it is BASELINE_RETRAIN_DAYS old (default 7,
 * 0 = off) and the published archive has changed since (src/lib/baseline.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { backupDatabase, keepCount, lastBackupAge } = await import("./lib/backup");
  const { getDb } = await import("./lib/db");

  const DAY = 24 * 60 * 60 * 1000;
  const { purgeExpiredIps } = await import("./lib/usage");
  const { scheduledRetrain } = await import("./lib/baseline");
  const check = async () => {
    try {
      const purged = purgeExpiredIps();
      if (purged) console.log(`[usage] cleared ${purged} expired IP addresses`);
    } catch (err) {
      console.error("[usage] purge failed:", err);
    }
    try {
      if (keepCount() > 0 && lastBackupAge() >= DAY) {
        const file = await backupDatabase(getDb());
        if (file) console.log(`[backup] database copied to ${file}`);
      }
    } catch (err) {
      console.error("[backup] failed:", err);
    }
    try {
      // A timer, not a request: the second or two of training never holds up a page.
      const { metrics } = scheduledRetrain(getDb());
      if (metrics) {
        console.log(`[baseline] scheduled retrain: ${metrics.docs} docs, accuracy ${metrics.accuracy}, macro-F1 ${metrics.macroF1}, ${metrics.trainMs} ms`);
      }
    } catch (err) {
      console.error("[baseline] scheduled retrain failed:", err);
    }
  };
  setTimeout(check, 60_000).unref();
  setInterval(check, 60 * 60 * 1000).unref();
}
