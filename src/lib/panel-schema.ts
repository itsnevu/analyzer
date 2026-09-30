import type { DatabaseSync } from "node:sqlite";

/**
 * Tables for the data copied from the legacy detector panel (/adminpanel/)
 * and for the detector's search log. Kept apart from db.ts so the import
 * script can load it without the Next.js path aliases. Idempotent.
 */
export function ensurePanelSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_sources (
      id          INTEGER PRIMARY KEY,          -- website id in the legacy panel
      site        TEXT NOT NULL,                -- hostname without "www."
      url         TEXT NOT NULL,
      lang        TEXT NOT NULL DEFAULT '',     -- en | id | ms
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS legacy_dataset (
      id          INTEGER PRIMARY KEY,          -- row id in the panel's dataset
      label       TEXT,                         -- HOAX, DISINFORMATION, FACT, ...; NULL = never labeled
      title       TEXT NOT NULL,
      publishedOn TEXT,                         -- YYYY-MM-DD read from the free-text date, NULL if unreadable
      url         TEXT NOT NULL DEFAULT '',
      sourceId    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_legacy_dataset_label ON legacy_dataset (label);

    CREATE TABLE IF NOT EXISTS searches (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      query     TEXT NOT NULL,
      verdict   TEXT,                           -- NULL for rows copied from the legacy log
      origin    TEXT NOT NULL DEFAULT 'site',   -- 'site' | 'legacy'
      legacyId  INTEGER UNIQUE,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_searches_created ON searches (createdAt DESC);
  `);
}
