import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import { isDatasetClass as isClass, type DatasetClass } from "./dataset-classes";
import { ensurePanelSchema } from "./panel-schema";

/**
 * Read side of the data copied from the legacy detector panel: the labeled
 * dataset and the sites it was scraped from. Filled by `npm run import:panel`.
 * Server-only.
 */

/** Bump when panel-schema.ts changes, so a hot-reloaded dev server re-runs it. */
const PANEL_SCHEMA = 1;
const globalForPanel = globalThis as unknown as { __hoaxPanelSchema?: number };

export function panelDb(): DatabaseSync {
  const db = getDb();
  if (globalForPanel.__hoaxPanelSchema !== PANEL_SCHEMA) {
    ensurePanelSchema(db);
    globalForPanel.__hoaxPanelSchema = PANEL_SCHEMA;
  }
  return db;
}

export interface DatasetOverview {
  labeled: number;
  unlabeled: number;
  byClass: Record<DatasetClass, number>;
  /** labels outside the four classes, such as EDUKASI or KLARIFIKASI, largest first */
  other: { label: string; count: number }[];
}

export function getDatasetOverview(): DatasetOverview {
  const rows = panelDb()
    .prepare("SELECT label, COUNT(*) AS n FROM legacy_dataset GROUP BY label ORDER BY n DESC")
    .all() as { label: string | null; n: number }[];
  const byClass = { HOAX: 0, INFORMATION: 0, DISINFORMATION: 0, FACT: 0 };
  const other: DatasetOverview["other"] = [];
  let labeled = 0;
  let unlabeled = 0;
  for (const r of rows) {
    if (r.label === null) unlabeled += r.n;
    else {
      labeled += r.n;
      if (isClass(r.label)) byClass[r.label] = r.n;
      else other.push({ label: r.label, count: r.n });
    }
  }
  return { labeled, unlabeled, byClass, other };
}

export interface YearCounts {
  year: string;
  byClass: Record<DatasetClass, number>;
  other: number;
}

/** Labeled rows per publish year, every year from the first to the last present. */
export function getDatasetByYear(): YearCounts[] {
  const rows = panelDb()
    .prepare(
      `SELECT substr(publishedOn, 1, 4) AS year, label, COUNT(*) AS n FROM legacy_dataset
       WHERE label IS NOT NULL AND publishedOn IS NOT NULL GROUP BY year, label`,
    )
    .all() as { year: string; label: string; n: number }[];
  if (!rows.length) return [];

  const years = rows.map((r) => Number(r.year));
  const out = new Map<string, YearCounts>();
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    out.set(String(y), { year: String(y), byClass: { HOAX: 0, INFORMATION: 0, DISINFORMATION: 0, FACT: 0 }, other: 0 });
  }
  for (const r of rows) {
    const bucket = out.get(r.year)!;
    if (isClass(r.label)) bucket.byClass[r.label] += r.n;
    else bucket.other += r.n;
  }
  return [...out.values()];
}

export interface SourceCounts {
  site: string;
  lang: string;
  labeled: number;
  unlabeled: number;
}

/** Dataset rows per source site, biggest first. */
export function getDatasetSources(): SourceCounts[] {
  return panelDb()
    .prepare(
      `SELECT COALESCE(s.site, 'unknown') AS site, COALESCE(s.lang, '') AS lang,
              SUM(d.label IS NOT NULL) AS labeled, SUM(d.label IS NULL) AS unlabeled
       FROM legacy_dataset d LEFT JOIN legacy_sources s ON s.id = d.sourceId
       GROUP BY site ORDER BY labeled + unlabeled DESC`,
    )
    .all() as unknown as SourceCounts[];
}
