import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Shared SQLite connection. The database lives at data/hoax.db (override
 * with DATABASE_PATH). Server-only — never import into a client component.
 */

const DB_FILE = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hoax.db");

/** Bump when migrate() changes, so a hot-reloaded dev server re-runs it on the open connection. */
const SCHEMA_VERSION = 3;

// Reuse one connection across dev hot reloads.
const globalForDb = globalThis as unknown as {
  __hoaxDb?: DatabaseSync;
  __hoaxSchema?: number;
  __hoaxFts?: boolean;
};

export function getDb(): DatabaseSync {
  if (globalForDb.__hoaxDb && globalForDb.__hoaxSchema === SCHEMA_VERSION) return globalForDb.__hoaxDb;

  let db = globalForDb.__hoaxDb;
  if (!db) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    db = new DatabaseSync(DB_FILE);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA busy_timeout = 5000");
  }
  migrate(db);

  globalForDb.__hoaxDb = db;
  globalForDb.__hoaxSchema = SCHEMA_VERSION;
  return db;
}

/** False when this Node build's SQLite lacks FTS5; search then falls back to LIKE. */
export function hasFts(): boolean {
  getDb();
  return globalForDb.__hoaxFts === true;
}

/** Every step is idempotent, so it is safe on a fresh file and on any older database. */
function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      lang        TEXT NOT NULL,
      category    TEXT NOT NULL,
      verdict     TEXT NOT NULL,
      date        TEXT NOT NULL,
      summaryId   TEXT NOT NULL DEFAULT '',
      summaryEn   TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL DEFAULT '',
      narration   TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL DEFAULT '',
      reference   TEXT NOT NULL DEFAULT '',
      image       TEXT NOT NULL DEFAULT '',
      originalUrl TEXT,
      createdAt   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName  TEXT NOT NULL DEFAULT '',
      email     TEXT NOT NULL,
      subject   TEXT NOT NULL,
      message   TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Columns added after the first release.
  const columns = new Set(db.prepare("PRAGMA table_info(articles)").all().map((c) => String(c.name)));
  const addColumn = (name: string, ddl: string) => {
    if (!columns.has(name)) db.exec(`ALTER TABLE articles ADD COLUMN ${name} ${ddl}`);
  };
  addColumn("published", "INTEGER NOT NULL DEFAULT 1"); // 0 = hidden from the public site
  addColumn("sourceSite", "TEXT NOT NULL DEFAULT ''"); // publisher of an imported fact-check
  addColumn("label", "TEXT NOT NULL DEFAULT ''"); // class label carried over from the legacy dataset
  addColumn("legacyId", "INTEGER"); // post id on the legacy WordPress site
  addColumn("datasetId", "INTEGER"); // row id in the legacy detector's labeled dataset

  db.exec(`
    DROP INDEX IF EXISTS idx_articles_date;
    CREATE INDEX IF NOT EXISTS idx_articles_public ON articles (published, date DESC, id DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_legacy ON articles (legacyId) WHERE legacyId IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_dataset ON articles (datasetId) WHERE datasetId IS NOT NULL;
  `);

  try {
    const existed = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'articles_fts'").get();
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
        title, narration, explanation, summaryId, summaryEn,
        content='articles', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS articles_vocab USING fts5vocab(articles_fts, 'row');

      CREATE TRIGGER IF NOT EXISTS articles_fts_insert AFTER INSERT ON articles BEGIN
        INSERT INTO articles_fts (rowid, title, narration, explanation, summaryId, summaryEn)
        VALUES (new.id, new.title, new.narration, new.explanation, new.summaryId, new.summaryEn);
      END;
      CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
        INSERT INTO articles_fts (articles_fts, rowid, title, narration, explanation, summaryId, summaryEn)
        VALUES ('delete', old.id, old.title, old.narration, old.explanation, old.summaryId, old.summaryEn);
      END;
      CREATE TRIGGER IF NOT EXISTS articles_fts_update AFTER UPDATE ON articles BEGIN
        INSERT INTO articles_fts (articles_fts, rowid, title, narration, explanation, summaryId, summaryEn)
        VALUES ('delete', old.id, old.title, old.narration, old.explanation, old.summaryId, old.summaryEn);
        INSERT INTO articles_fts (rowid, title, narration, explanation, summaryId, summaryEn)
        VALUES (new.id, new.title, new.narration, new.explanation, new.summaryId, new.summaryEn);
      END;
    `);
    // Index the rows that were there before the search table existed.
    if (!existed) db.exec("INSERT INTO articles_fts (articles_fts) VALUES ('rebuild')");
    globalForDb.__hoaxFts = true;
  } catch (err) {
    console.warn("[db] full-text search unavailable, falling back to LIKE:", err);
    globalForDb.__hoaxFts = false;
  }
}
