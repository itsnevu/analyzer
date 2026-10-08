import type { DatabaseSync } from "node:sqlite";

/**
 * Tables for the data copied from the legacy detector panel (/adminpanel/),
 * the detector's search log, and the panel's settings (stopwords, HTML entity
 * replacements, skipped domains, crawl queue). Kept apart from db.ts so the
 * import scripts can load it without the Next.js path aliases. Idempotent.
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
    CREATE INDEX IF NOT EXISTS idx_legacy_dataset_source ON legacy_dataset (sourceId);

    CREATE TABLE IF NOT EXISTS searches (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      query     TEXT NOT NULL,
      verdict   TEXT,                           -- NULL for rows copied from the legacy log
      origin    TEXT NOT NULL DEFAULT 'site',   -- 'site' | 'legacy'
      legacyId  INTEGER UNIQUE,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_searches_created ON searches (createdAt DESC);

    -- Settings carried over from the legacy panel (HOAX SETTING menu); editable in /admin/settings.
    CREATE TABLE IF NOT EXISTS stopwords (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      lang   TEXT NOT NULL,                     -- en | id | ms
      word   TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'site',      -- 'legacy' = copied from the old panel, 'site' = added here
      UNIQUE (lang, word)
    );
    CREATE TABLE IF NOT EXISTS html_tags (
      id  INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,                 -- entity as the old panel wrote it: "#8216;", "amp;"
      alt TEXT NOT NULL DEFAULT ''              -- what it is replaced with
    );
    CREATE TABLE IF NOT EXISTS skip_domains (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,              -- hostname without "www."
      note   TEXT NOT NULL DEFAULT ''
    );
    -- The legacy crawler's list of listing pages per source site (DATA HOAX > Hoax Dataset > URL Page).
    CREATE TABLE IF NOT EXISTS crawl_queue (
      id       INTEGER PRIMARY KEY,             -- row id in the legacy panel
      sourceId INTEGER,
      url      TEXT NOT NULL,
      page     INTEGER NOT NULL DEFAULT 0,
      lastPage INTEGER NOT NULL DEFAULT 0,
      suffix   TEXT NOT NULL DEFAULT '',
      status   TEXT NOT NULL DEFAULT ''         -- Begin | Continued | Finish, as the panel showed it
    );
  `);

  // Columns added after the first import.
  const columnAdder = (table: string) => {
    const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => String(c.name)));
    return (name: string, ddl: string) => {
      if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    };
  };
  const addSource = columnAdder("legacy_sources");
  addSource("htmlPage", "TEXT NOT NULL DEFAULT ''"); // "URL Page" in the panel: path of the listing page
  addSource("header", "INTEGER NOT NULL DEFAULT 0"); // "Header Page": the crawler kept the page header
  addSource("stemming", "INTEGER NOT NULL DEFAULT 0"); // "Stamming": stem words from this site
  addSource("socialMedia", "TEXT NOT NULL DEFAULT ''");
  addSource("active", "INTEGER NOT NULL DEFAULT 1"); // 0 = no longer collected from
  addSource("origin", "TEXT NOT NULL DEFAULT 'legacy'"); // 'legacy' = from the old panel, 'site' = added here

  const addDataset = columnAdder("legacy_dataset");
  addDataset("adminLabel", "TEXT"); // label given in this admin panel; wins over the imported one
  addDataset("reviewedAt", "TEXT");
}
