/**
 * Makes a consistent copy of the database now, e.g. before an upgrade or to
 * move the site to another server. Safe while the site is running.
 *
 *   npm run db:backup
 */

import { DatabaseSync } from "node:sqlite";
import { backupDatabase, databaseFile, keepCount } from "../src/lib/backup.ts";

const db = new DatabaseSync(databaseFile(), { readOnly: true });
const file = await backupDatabase(db, Math.max(keepCount(), 1));
console.log(file ? `Database copied to ${file}` : "Backups are turned off (DB_BACKUP_KEEP=0).");
