import { deleteArticle, getArticleBySlug, saveArticle } from "./articles";
import type { Article } from "./data";
import { getDb } from "./db";
import { CLASS_RESULT } from "./extract";

/**
 * Review queue (/admin/review): articles imported without a verdict from
 * their publisher stay hidden until an editor picks one. Server-only.
 */

export const REVIEW_ACTIONS = ["hoax", "misleading", "valid", "delete"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export function isReviewAction(v: unknown): v is ReviewAction {
  return (REVIEW_ACTIONS as readonly unknown[]).includes(v);
}

/** Verdict and category words for the three verdict buttons, the same as CLASS_RESULT in scripts/legacy-clean.ts. */
export const REVIEW_RESULT: Record<Exclude<ReviewAction, "delete">, { verdict: Article["verdict"]; category: string }> = {
  hoax: CLASS_RESULT.hoax,
  misleading: CLASS_RESULT.misleading,
  valid: CLASS_RESULT.true,
};

export const EXCERPT_CHARS = 400;

export interface ReviewItem {
  slug: string;
  title: string;
  lang: Article["lang"];
  category: string;
  verdict: Article["verdict"];
  date: string;
  sourceSite: string;
  /** Class label carried over from the legacy dataset ("HOAX", "INFORMATION", …), "" when none. */
  label: string;
  originalUrl: string;
  archiveUrl: string;
  /** Opening of the narration and explanation (EXCERPT_CHARS each). */
  narration: string;
  explanation: string;
  narrationLength: number;
  explanationLength: number;
}

export interface ReviewQueue {
  items: ReviewItem[];
  /** Hidden articles in all, which may be more than `items`. */
  total: number;
}

type Row = Omit<ReviewItem, "lang" | "verdict"> & { lang: string; verdict: string };

/** Hidden articles, newest first, with what a reviewer needs to decide. */
export async function listReviewQueue(limit = 100): Promise<ReviewQueue> {
  const conn = getDb();
  const { n: total } = conn.prepare("SELECT COUNT(*) AS n FROM articles WHERE published = 0").get() as { n: number };
  const rows = conn
    .prepare(
      `SELECT slug, title, lang, category, verdict, date, sourceSite, label, COALESCE(originalUrl, '') AS originalUrl, archiveUrl,
              substr(narration, 1, ?) AS narration, substr(explanation, 1, ?) AS explanation,
              length(narration) AS narrationLength, length(explanation) AS explanationLength
       FROM articles WHERE published = 0 ORDER BY date DESC, id DESC LIMIT ?`,
    )
    .all(EXCERPT_CHARS, EXCERPT_CHARS, Math.min(Math.max(limit, 1), 500)) as unknown as Row[];
  const items = rows.map((r) => ({
    ...r,
    lang: r.lang === "en" ? ("en" as const) : ("id" as const),
    verdict: (["hoax", "misleading", "valid"].includes(r.verdict) ? r.verdict : "misleading") as Article["verdict"],
  }));
  return { items, total };
}

/**
 * Applies a reviewer's decision: a verdict publishes the article with the
 * matching category; "delete" removes it. Returns false when the slug is unknown.
 */
export async function reviewArticle(slug: string, action: ReviewAction): Promise<boolean> {
  const article = await getArticleBySlug(slug, true);
  if (!article) return false;
  if (action === "delete") {
    await deleteArticle(slug);
    return true;
  }
  const { verdict, category } = REVIEW_RESULT[action];
  await saveArticle({ ...article, verdict, category, published: true });
  return true;
}
