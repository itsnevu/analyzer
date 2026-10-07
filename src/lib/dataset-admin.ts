import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { panelDb } from "./legacy-panel";
import { slugify } from "./slug";
import { cleanDatasetRow, type DatasetRow } from "../../scripts/legacy-clean";

/**
 * Browse and curate the legacy detector's dataset (/admin/dataset): filter the
 * rows, give a row a new label, and copy a row into the article archive the way
 * `npm run import:legacy` does. Server-only.
 */

/** Labels the old panel used, in the order the dropdown shows them. */
export const DATASET_LABELS = ["HOAX", "DISINFORMATION", "INFORMATION", "FACT", "EDUKASI", "KLARIFIKASI", "UNKNOWN"] as const;
export type DatasetLabel = (typeof DATASET_LABELS)[number];

export function isDatasetLabel(v: unknown): v is DatasetLabel {
  return typeof v === "string" && (DATASET_LABELS as readonly string[]).includes(v);
}

export type DatasetTab = "categorized" | "uncategorized";

/** Columns the grid can sort by. */
export const DATASET_SORTS = ["date", "title", "id"] as const;
export type DatasetSort = (typeof DATASET_SORTS)[number];
export type SortOrder = "asc" | "desc";

export function isDatasetSort(v: unknown): v is DatasetSort {
  return typeof v === "string" && (DATASET_SORTS as readonly string[]).includes(v);
}

export interface DatasetFilter {
  tab?: DatasetTab;
  /** effective label; ignored on the uncategorized tab */
  label?: string;
  /** title search, substring match */
  q?: string;
  /** legacy_sources.id */
  source?: number;
  /** publish year, YYYY */
  year?: string;
  /** "yes" = already in the archive, "no" = not yet */
  archived?: "yes" | "no" | "";
  /** default: date, newest first */
  sort?: DatasetSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface DatasetItem {
  id: number;
  /** label as imported from the old panel */
  label: string | null;
  /** label given here, when it differs */
  adminLabel: string | null;
  effectiveLabel: string | null;
  reviewedAt: string | null;
  title: string;
  publishedOn: string | null;
  url: string;
  sourceId: number | null;
  site: string;
  /** slug of the archive entry made from this row, if any */
  archiveSlug: string | null;
  archivePublished: boolean;
}

export interface DatasetPage {
  items: DatasetItem[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

const EFFECTIVE = "COALESCE(d.adminLabel, d.label)";
const SELECT = `SELECT d.id, d.label, d.adminLabel, ${EFFECTIVE} AS effectiveLabel, d.reviewedAt,
       d.title, d.publishedOn, d.url, d.sourceId, COALESCE(s.site, '') AS site,
       a.slug AS archiveSlug, a.published AS archivePublished
  FROM legacy_dataset d
  LEFT JOIN legacy_sources s ON s.id = d.sourceId
  LEFT JOIN articles a ON a.datasetId = d.id`;

function whereSql(f: DatasetFilter): { sql: string; args: (string | number)[] } {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.tab === "uncategorized") where.push(`${EFFECTIVE} IS NULL`);
  else {
    where.push(`${EFFECTIVE} IS NOT NULL`);
    if (f.label) {
      where.push(`${EFFECTIVE} = ?`);
      args.push(f.label.toUpperCase());
    }
  }
  if (f.q?.trim()) {
    where.push("d.title LIKE ?");
    args.push(`%${f.q.trim()}%`);
  }
  if (f.source) {
    where.push("d.sourceId = ?");
    args.push(f.source);
  }
  if (f.year && /^\d{4}$/.test(f.year)) {
    where.push("substr(d.publishedOn, 1, 4) = ?");
    args.push(f.year);
  }
  if (f.archived === "yes") where.push("a.id IS NOT NULL");
  if (f.archived === "no") where.push("a.id IS NULL");
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", args };
}

/** The order a filter asks for, defaults filled in: titles A–Z, dates and ids newest first. */
export function datasetSortOf(f: DatasetFilter): { key: DatasetSort; order: SortOrder } {
  const key = f.sort ?? "date";
  return { key, order: f.order ?? (key === "title" ? "asc" : "desc") };
}

function orderSql(f: DatasetFilter): string {
  const { key, order } = datasetSortOf(f);
  const dir = order === "asc" ? "ASC" : "DESC";
  // Rows without a date go last either way; the id breaks ties so paging is stable.
  if (key === "date") return `ORDER BY d.publishedOn IS NULL, d.publishedOn ${dir}, d.id ${dir}`;
  if (key === "title") return `ORDER BY d.title COLLATE NOCASE ${dir}, d.id ${dir}`;
  return `ORDER BY d.id ${dir}`;
}

type Row = Record<string, unknown>;

function toItem(r: Row): DatasetItem {
  return {
    id: Number(r.id),
    label: (r.label as string | null) ?? null,
    adminLabel: (r.adminLabel as string | null) ?? null,
    effectiveLabel: (r.effectiveLabel as string | null) ?? null,
    reviewedAt: (r.reviewedAt as string | null) ?? null,
    title: String(r.title),
    publishedOn: (r.publishedOn as string | null) ?? null,
    url: String(r.url ?? ""),
    sourceId: r.sourceId == null ? null : Number(r.sourceId),
    site: String(r.site ?? ""),
    archiveSlug: (r.archiveSlug as string | null) ?? null,
    archivePublished: r.archivePublished === 1,
  };
}

export function listDataset(f: DatasetFilter = {}): DatasetPage {
  const db = panelDb();
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 200);
  const { sql, args } = whereSql(f);
  const { n: total } = db
    .prepare(`SELECT COUNT(*) AS n FROM legacy_dataset d LEFT JOIN articles a ON a.datasetId = d.id ${sql}`)
    .get(...args) as { n: number };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(f.page ?? 1) || 1, 1), pages);
  const rows = db.prepare(`${SELECT} ${sql} ${orderSql(f)} LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as Row[];
  return { items: rows.map(toItem), total, page, pages, pageSize };
}

export function getDatasetItem(id: number): DatasetItem | null {
  const row = panelDb().prepare(`${SELECT} WHERE d.id = ?`).get(id) as Row | undefined;
  return row ? toItem(row) : null;
}

/** Publish years present in the dataset, newest first. */
export function getDatasetYears(): string[] {
  const rows = panelDb()
    .prepare("SELECT DISTINCT substr(publishedOn, 1, 4) AS y FROM legacy_dataset WHERE publishedOn IS NOT NULL ORDER BY y DESC")
    .all() as { y: string }[];
  return rows.map((r) => r.y);
}

/** Source sites to filter by, with how many dataset rows each has. */
export function getDatasetSourceOptions(): { id: number; site: string; count: number }[] {
  return panelDb()
    .prepare(
      `SELECT s.id, s.site, COUNT(d.id) AS count FROM legacy_sources s
       LEFT JOIN legacy_dataset d ON d.sourceId = s.id GROUP BY s.id ORDER BY count DESC, s.site`,
    )
    .all() as unknown as { id: number; site: string; count: number }[];
}

/** Sets the label given here (null clears it so the imported one counts again). */
export function setDatasetLabel(id: number, label: DatasetLabel | null): boolean {
  const r = panelDb().prepare("UPDATE legacy_dataset SET adminLabel = ?, reviewedAt = CURRENT_TIMESTAMP WHERE id = ?").run(label, id);
  return Number(r.changes) > 0;
}

/** The current filter as CSV, one row per dataset entry, in the grid's order. */
export function* datasetCsv(f: DatasetFilter): Generator<string> {
  const cols = ["id", "label", "adminLabel", "effectiveLabel", "reviewedAt", "title", "publishedOn", "url", "site", "archiveSlug"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  yield "﻿" + cols.join(",") + "\n";
  const { sql, args } = whereSql(f);
  const rows = panelDb().prepare(`${SELECT} ${sql} ${orderSql(f)}`).iterate(...args) as Iterable<Row>;
  for (const row of rows) yield cols.map((c) => cell(row[c])).join(",") + "\n";
}

/* ------------------------------------------------------- add to archive */

// The panel's grid exports hold the article text the dataset table leaves out.
const EXPORT_DIR = process.env.LEGACY_PANEL_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "legacy-panel", "panel");
const EXPORT_FILES = ["hoax-master-data-categorized.json", "hoax-master-data-uncategorized.json"];

/** The raw export row for a dataset id, or null when the export files are not on this machine. */
function readExportRow(id: number): DatasetRow | null {
  for (const file of EXPORT_FILES) {
    const full = path.join(/* turbopackIgnore: true */ EXPORT_DIR, file);
    if (!fs.existsSync(full)) continue;
    const rows = (JSON.parse(fs.readFileSync(full, "utf8")) as { rows?: DatasetRow[] }).rows ?? [];
    const row = rows.find((r) => Number(r.id) === id);
    if (row) return row;
  }
  return null;
}

const normUrl = (u: string) => {
  let s = u;
  try {
    s = decodeURIComponent(u);
  } catch {
    /* keep as is */
  }
  return s.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
};

export type AddResult =
  | { ok: true; slug: string; published: boolean; withText: boolean }
  | { ok: false; status: 404 | 409; error: string; slug?: string };

/**
 * Copies one dataset row into the article archive, the way the import script
 * does: the effective label gives the verdict (a published entry), no verdict
 * means a hidden entry; the text comes from the panel export when it is there.
 */
export function addDatasetRowToArchive(id: number): AddResult {
  const item = getDatasetItem(id);
  if (!item) return { ok: false, status: 404, error: "Dataset row not found." };
  if (item.archiveSlug) return { ok: false, status: 409, error: "Already in the archive.", slug: item.archiveSlug };

  const db = getDb();
  const exported = readExportRow(id);
  const row: DatasetRow = {
    id: String(id),
    text_category: item.effectiveLabel,
    title: exported?.title ?? item.title,
    author: exported?.author ?? null,
    publish_date: exported?.publish_date ?? null,
    text: exported?.text ?? null,
    url: exported?.url?.trim() || item.url,
    website: String(item.sourceId ?? ""),
  };
  const a = cleanDatasetRow(row);
  if (!a.date && item.publishedOn) a.date = item.publishedOn;

  // The same fact-check may already be there under its WordPress copy.
  if (a.originalUrl) {
    const key = normUrl(a.originalUrl);
    const candidates = db
      .prepare("SELECT slug, originalUrl FROM articles WHERE originalUrl LIKE ? LIMIT 50")
      .all(`%${key.replace(/[%_]/g, "")}%`) as { slug: string; originalUrl: string }[];
    const twin = key.length >= 12 ? candidates.find((c) => normUrl(c.originalUrl) === key) : undefined;
    if (twin) return { ok: false, status: 409, error: "Already in the archive under the same link.", slug: twin.slug };
  }

  const title = a.title || a.explanation.split("\n")[0].slice(0, 90) || "Untitled fact-check";
  const visible = a.verdict !== null;
  const slug = `${slugify(title).slice(0, 70).replace(/-+$/, "") || "fact-check"}-d${id}`;
  try {
    db.prepare(
      `INSERT INTO articles (slug, title, lang, category, verdict, date, summaryId, summaryEn, source, narration,
         explanation, reference, image, originalUrl, published, sourceSite, label, legacyId, datasetId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      slug, title, a.lang, a.category, a.verdict ?? "misleading", a.date,
      a.lang === "id" ? a.summary : "", a.lang === "en" ? a.summary : "",
      a.source, a.narration, a.explanation, a.reference, "", a.originalUrl || null,
      visible ? 1 : 0, a.sourceSite, a.label, null, id,
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) {
      const taken = db.prepare("SELECT slug FROM articles WHERE slug = ? OR datasetId = ?").get(slug, id) as { slug: string } | undefined;
      return { ok: false, status: 409, error: "An article with this slug already exists.", slug: taken?.slug ?? slug };
    }
    throw err;
  }
  return { ok: true, slug, published: visible, withText: !!(a.explanation || a.narration) };
}

/** Reads the filter from query parameters (page, API and export share it); `sort`/`order` come back with their defaults filled in. */
export function datasetFilterFrom(get: (key: string) => string | undefined): DatasetFilter {
  const archived = get("archived");
  const sort = get("sort");
  const order = get("order");
  const f: DatasetFilter = {
    tab: get("tab") === "uncategorized" ? "uncategorized" : "categorized",
    label: isDatasetLabel(get("label")?.toUpperCase()) ? get("label")?.toUpperCase() : "",
    q: (get("q") ?? "").trim().slice(0, 200),
    source: Number(get("source")) || undefined,
    year: /^\d{4}$/.test(get("year") ?? "") ? get("year") : "",
    archived: archived === "yes" || archived === "no" ? archived : "",
    sort: isDatasetSort(sort) ? sort : "date",
    order: order === "asc" || order === "desc" ? order : undefined,
    page: Number(get("page")) || 1,
    pageSize: Number(get("pageSize")) || undefined,
  };
  return { ...f, ...datasetSortOf(f) };
}
