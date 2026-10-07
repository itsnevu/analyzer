import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import type { Verdict } from "./detect";
import { jaccard, tokenizeWords } from "./similarity";

/**
 * "Needs attention" (/admin/attention): what the public detector could not
 * answer from the archive, read from the research log (usage_log, see
 * ./usage). Only public checks count (staff = 0) and nothing here carries an
 * IP address or browser id. Server-only.
 *
 * Three views:
 *  - unmatched: checks with no archive match, grouped into near-duplicate
 *    claims (Jaccard of the folded word sets >= GROUP_THRESHOLD against the
 *    group's first text; link checks group by their address);
 *  - disagreements: checks whose archive match says one thing and the
 *    engine's own probability another, for spotting wrong matches;
 *  - low confidence: unmatched checks the engine was unsure about.
 *
 * Dismissed groups live in attention_dismissed, created here on first use.
 */

export const ATTENTION_DAYS = [7, 30, 90] as const;
export type AttentionDays = (typeof ATTENTION_DAYS)[number];
export const DEFAULT_DAYS: AttentionDays = 30;

export function attentionDays(v: unknown): AttentionDays {
  const n = Number(v);
  return (ATTENTION_DAYS as readonly number[]).includes(n) ? (n as AttentionDays) : DEFAULT_DAYS;
}

export const ATTENTION_TABS = ["unmatched", "disagreements", "low"] as const;
export type AttentionTab = (typeof ATTENTION_TABS)[number];

export function attentionTab(v: unknown): AttentionTab {
  return (ATTENTION_TABS as readonly unknown[]).includes(v) ? (v as AttentionTab) : "unmatched";
}

/** Newest rows scanned for grouping; keeps the page quick however busy the site gets. */
export const SCAN_LIMIT = 2000;
/** Two texts are the same claim when their word sets overlap this much. */
export const GROUP_THRESHOLD = 0.6;
/** Hoax probabilities the engine itself is unsure about. */
export const LOW_CONFIDENCE: readonly [number, number] = [0.4, 0.6];
/** Groups or checks returned to a page at most. */
export const LIST_LIMIT = 200;
/** Longest text handed to a page or a `?text=` prefill link; the full text stays in the log. */
export const TEXT_LIMIT = 6000;

export interface AttentionGroup {
  /** Stable hash of the representative text's folded words; what "Dismiss" stores. */
  key: string;
  /** Longest text in the group (capped at TEXT_LIMIT), or the address for link checks. */
  text: string;
  /** Characters in the full representative text. */
  chars: number;
  isLink: boolean;
  url: string;
  pageTitle: string;
  /** Checks in the group. */
  count: number;
  firstSeen: string;
  lastSeen: string;
  /** The engine's most frequent verdict for the group, "" when none was logged. */
  verdict: Verdict | "";
  /** Mean hoax probability, 0..1. */
  probability: number;
  langs: string[];
  engines: string[];
}

export interface AttentionCheck {
  id: number;
  at: string;
  text: string;
  isLink: boolean;
  url: string;
  pageTitle: string;
  lang: string;
  verdict: Verdict | "";
  probability: number;
  engine: string;
}

export interface Disagreement extends AttentionCheck {
  /** The fact-check the detector answered with. */
  match: { slug: string; title: string; verdict: Verdict; published: boolean };
  /** What the engine's probability alone would have said. */
  band: "hoax" | "valid";
}

export interface AttentionList {
  days: AttentionDays;
  groups: AttentionGroup[];
  /** Open groups in all, which may be more than `groups`. */
  total: number;
  /** Checks that were scanned. */
  scanned: number;
  /** Groups hidden because the admin dismissed them. */
  dismissed: number;
}

/* ---------------------------------------------------------------- storage */

const prepared = new WeakSet<DatabaseSync>();

function db(): DatabaseSync {
  const conn = getDb();
  if (!prepared.has(conn)) {
    conn.exec("CREATE TABLE IF NOT EXISTS attention_dismissed (key TEXT PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    prepared.add(conn);
  }
  return conn;
}

/** The same claim written with different spacing, punctuation or case gives the same key. */
export function attentionKey(text: string): string {
  return createHash("sha1").update(tokenizeWords(text).join(" ")).digest("hex").slice(0, 16);
}

export function dismissAttention(key: string): void {
  if (!/^[0-9a-f]{16}$/.test(key)) throw new Error("Invalid key.");
  db().prepare("INSERT OR IGNORE INTO attention_dismissed (key) VALUES (?)").run(key);
}

/** Brings a dismissed group back. Returns false when the key was not dismissed. */
export function restoreAttention(key: string): boolean {
  return Number(db().prepare("DELETE FROM attention_dismissed WHERE key = ?").run(key).changes) > 0;
}

function dismissedKeys(): Set<string> {
  return new Set((db().prepare("SELECT key FROM attention_dismissed").all() as { key: string }[]).map((r) => r.key));
}

/* ---------------------------------------------------------------- rows */

interface CheckRow {
  id: number;
  at: string;
  text: string;
  url: string;
  pageTitle: string;
  lang: string;
  verdict: string;
  probability: number | null;
  engine: string;
  matches: number | null;
  topMatch: string;
}

const CHECK_COLUMNS = "id, at, text, url, pageTitle, lang, verdict, probability, engine, matches, topMatch";
/** Checks by the public that went through; legacy rows have no matches column value and drop out. */
const PUBLIC_CHECKS = "kind = 'check' AND staff = 0 AND error = ''";

const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const asVerdict = (v: unknown): Verdict | "" => (v === "hoax" || v === "misleading" || v === "valid" ? v : "");

function toCheck(r: CheckRow): AttentionCheck {
  return {
    id: Number(r.id),
    at: r.at,
    text: r.text.slice(0, TEXT_LIMIT),
    isLink: r.url !== "",
    url: r.url,
    pageTitle: r.pageTitle,
    lang: r.lang,
    verdict: asVerdict(r.verdict),
    probability: Number(r.probability ?? 0),
    engine: r.engine,
  };
}

/* ---------------------------------------------------------------- grouping */

interface Builder {
  /** Distinct folded words of the group's first text; empty for link groups. */
  words: string[];
  urlKey: string;
  rep: string;
  isLink: boolean;
  url: string;
  pageTitle: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  verdicts: Map<string, number>;
  probSum: number;
  probN: number;
  langs: Set<string>;
  engines: Set<string>;
  /** Keys of every member text, so a dismissal survives a change of representative. */
  keys: Set<string>;
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return raw.trim();
  }
}

function startGroup(row: CheckRow, words: string[]): Builder {
  const isLink = row.url !== "";
  return {
    words,
    urlKey: isLink ? normalizeUrl(row.url) : "",
    rep: isLink ? row.url : row.text,
    isLink,
    url: row.url,
    pageTitle: row.pageTitle,
    count: 0,
    firstSeen: row.at,
    lastSeen: row.at,
    verdicts: new Map(),
    probSum: 0,
    probN: 0,
    langs: new Set(),
    engines: new Set(),
    keys: new Set(),
  };
}

function join(b: Builder, row: CheckRow): void {
  b.count++;
  if (row.at < b.firstSeen) b.firstSeen = row.at;
  if (row.at > b.lastSeen) b.lastSeen = row.at;
  if (!b.isLink && row.text.length > b.rep.length) b.rep = row.text;
  if (!b.pageTitle && row.pageTitle) b.pageTitle = row.pageTitle;
  const v = asVerdict(row.verdict);
  if (v) b.verdicts.set(v, (b.verdicts.get(v) ?? 0) + 1);
  if (row.probability !== null) {
    b.probSum += Number(row.probability);
    b.probN++;
  }
  if (row.lang) b.langs.add(row.lang);
  if (row.engine) b.engines.add(row.engine);
  b.keys.add(attentionKey(b.isLink ? row.url : row.text));
}

function finish(b: Builder): AttentionGroup {
  const verdict = [...b.verdicts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] as Verdict | undefined;
  return {
    key: attentionKey(b.rep),
    text: b.rep.slice(0, TEXT_LIMIT),
    chars: b.rep.length,
    isLink: b.isLink,
    url: b.url,
    pageTitle: b.pageTitle,
    count: b.count,
    firstSeen: b.firstSeen,
    lastSeen: b.lastSeen,
    verdict: verdict ?? "",
    probability: b.probN ? b.probSum / b.probN : 0,
    langs: [...b.langs].sort(),
    engines: [...b.engines].sort(),
  };
}

/**
 * Near-duplicate grouping, newest row first so each group's seed is its
 * latest wording. An inverted index of words gives the candidate groups; a
 * group can only reach the threshold when it shares at least
 * GROUP_THRESHOLD of the new text's words, so most groups are never scored.
 */
function groupRows(rows: CheckRow[]): Builder[] {
  const groups: Builder[] = [];
  const byUrl = new Map<string, Builder>();
  const index = new Map<string, number[]>();

  for (const row of rows) {
    if (row.url !== "") {
      const k = normalizeUrl(row.url);
      let g = byUrl.get(k);
      if (!g) {
        g = startGroup(row, []);
        byUrl.set(k, g);
        groups.push(g);
      }
      join(g, row);
      continue;
    }

    const words = [...new Set(tokenizeWords(row.text))];
    const need = Math.ceil(words.length * GROUP_THRESHOLD);
    const shared = new Map<number, number>();
    for (const w of words) for (const i of index.get(w) ?? []) shared.set(i, (shared.get(i) ?? 0) + 1);
    let best: Builder | undefined;
    let bestScore = 0;
    for (const [i, n] of shared) {
      if (n < need) continue;
      const score = jaccard(words, groups[i].words);
      if (score >= GROUP_THRESHOLD && score > bestScore) {
        best = groups[i];
        bestScore = score;
      }
    }
    if (!best) {
      best = startGroup(row, words);
      const i = groups.push(best) - 1;
      for (const w of words) {
        const list = index.get(w);
        if (list) list.push(i);
        else index.set(w, [i]);
      }
    }
    join(best, row);
  }
  return groups;
}

function openGroups(days: number): { open: AttentionGroup[]; scanned: number; dismissed: number } {
  const rows = db()
    .prepare(`SELECT ${CHECK_COLUMNS} FROM usage_log WHERE ${PUBLIC_CHECKS} AND matches = 0 AND at >= ? ORDER BY at DESC, id DESC LIMIT ?`)
    .all(sinceIso(days), SCAN_LIMIT) as unknown as CheckRow[];
  const hidden = dismissedKeys();
  let dismissed = 0;
  const open: AttentionGroup[] = [];
  for (const b of groupRows(rows)) {
    const g = finish(b);
    if (hidden.has(g.key) || [...b.keys].some((k) => hidden.has(k))) dismissed++;
    else open.push(g);
  }
  open.sort((a, b) => b.count - a.count || b.probability - a.probability || (a.lastSeen < b.lastSeen ? 1 : -1));
  return { open, scanned: rows.length, dismissed };
}

/** Unmatched claims, most checked first; dismissed groups left out. */
export function listAttention(days: AttentionDays = DEFAULT_DAYS): AttentionList {
  const { open, scanned, dismissed } = openGroups(days);
  return { days, groups: open.slice(0, LIST_LIMIT), total: open.length, scanned, dismissed };
}

/** Open unmatched groups, for the sidebar badge and the dashboard. */
export function countOpenAttention(days: number = DEFAULT_DAYS): number {
  return openGroups(days).open.length;
}

/* ---------------------------------------------------------------- the other tabs */

/**
 * Checks where the archive match's verdict and the engine's probability
 * point different ways: a hoax match the engine found credible (p < 0.4), or
 * a credible match it found hoax-like (p > 0.6). The verdict logged for the
 * check is the match's, so the probability is the only trace of the engine's
 * own view. A misleading match never disagrees.
 */
export function listDisagreements(days: AttentionDays = DEFAULT_DAYS): Disagreement[] {
  const rows = db()
    .prepare(
      `SELECT u.id, u.at, u.text, u.url, u.pageTitle, u.lang, u.verdict, u.probability, u.engine, u.matches, u.topMatch,
              a.title AS matchTitle, a.verdict AS matchVerdict, a.published AS matchPublished
       FROM usage_log u JOIN articles a ON a.slug = u.topMatch
       WHERE u.kind = 'check' AND u.staff = 0 AND u.error = '' AND u.topMatch != '' AND u.probability IS NOT NULL AND u.at >= ?
         AND ((a.verdict = 'hoax' AND u.probability < ?) OR (a.verdict = 'valid' AND u.probability > ?))
       ORDER BY u.at DESC, u.id DESC LIMIT ?`,
    )
    .all(sinceIso(days), LOW_CONFIDENCE[0], LOW_CONFIDENCE[1], LIST_LIMIT) as unknown as (CheckRow & {
    matchTitle: string;
    matchVerdict: string;
    matchPublished: number;
  })[];
  return rows.map((r) => ({
    ...toCheck(r),
    match: { slug: r.topMatch, title: r.matchTitle, verdict: asVerdict(r.matchVerdict) || "misleading", published: Number(r.matchPublished) === 1 },
    band: Number(r.probability) > LOW_CONFIDENCE[1] ? "hoax" : "valid",
  }));
}

/** Unmatched checks with a hoax probability inside LOW_CONFIDENCE, newest first. */
export function listLowConfidence(days: AttentionDays = DEFAULT_DAYS): AttentionCheck[] {
  const rows = db()
    .prepare(
      `SELECT ${CHECK_COLUMNS} FROM usage_log
       WHERE ${PUBLIC_CHECKS} AND matches = 0 AND probability >= ? AND probability <= ? AND at >= ?
       ORDER BY at DESC, id DESC LIMIT ?`,
    )
    .all(LOW_CONFIDENCE[0], LOW_CONFIDENCE[1], sinceIso(days), LIST_LIMIT) as unknown as CheckRow[];
  return rows.map(toCheck);
}

/* ---------------------------------------------------------------- dashboard */

/** Public checks of the last `days` days that found an archive match, and those that did not. */
export function checkMatchSplit(days: number): { matched: number; unmatched: number } {
  const r = db()
    .prepare(`SELECT COALESCE(SUM(matches > 0), 0) AS matched, COALESCE(SUM(matches = 0), 0) AS unmatched FROM usage_log WHERE ${PUBLIC_CHECKS} AND at >= ?`)
    .get(sinceIso(days)) as { matched: number; unmatched: number };
  return { matched: Number(r.matched), unmatched: Number(r.unmatched) };
}

/** The fact-checks the detector answered with most often. */
export function topMatchedArticles(days: number, limit = 5): { slug: string; title: string; verdict: Verdict; count: number }[] {
  const rows = db()
    .prepare(
      `SELECT u.topMatch AS slug, COALESCE(a.title, u.topMatch) AS title, COALESCE(a.verdict, 'misleading') AS verdict, COUNT(*) AS count
       FROM usage_log u LEFT JOIN articles a ON a.slug = u.topMatch
       WHERE u.kind = 'check' AND u.staff = 0 AND u.error = '' AND u.topMatch != '' AND u.at >= ?
       GROUP BY u.topMatch ORDER BY count DESC, u.topMatch LIMIT ?`,
    )
    .all(sinceIso(days), limit) as { slug: string; title: string; verdict: string; count: number }[];
  return rows.map((r) => ({ slug: r.slug, title: r.title, verdict: asVerdict(r.verdict) || "misleading", count: Number(r.count) }));
}

/** Public checks per calendar day (UTC) for the last `days` days, oldest first, empty days included. */
export function checksPerDay(days = 30): { day: string; count: number }[] {
  const start = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = db()
    .prepare(`SELECT substr(at, 1, 10) AS day, COUNT(*) AS count FROM usage_log WHERE ${PUBLIC_CHECKS} AND at >= ? GROUP BY day`)
    .all(start) as { day: string; count: number }[];
  const counts = new Map(rows.map((r) => [r.day, Number(r.count)]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
}
