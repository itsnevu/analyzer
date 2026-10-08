import type { Verdict } from "./detect";

export interface Article {
  slug: string;
  title: string;
  lang: "id" | "en";
  category: string;
  verdict: Verdict;
  date: string;
  summaryId: string;
  summaryEn: string;
  source: string;
  narration: string;
  explanation: string;
  reference: string;
  /** Empty for articles imported from the legacy archive, which have no cover of their own. */
  image: string;
  originalUrl?: string;
  /** Site that published the fact-check, for imported articles (e.g. "turnbackhoax.id"). */
  sourceSite?: string;
  /** False hides the article from the public site. Defaults to true. */
  published?: boolean;
  /** Internet Archive copy the text was recovered from, when the original page is gone. */
  archiveUrl?: string;
}

/** What a list or card shows; the article body stays in the database. */
export interface ArticleListItem {
  slug: string;
  title: string;
  lang: Article["lang"];
  category: string;
  verdict: Verdict;
  date: string;
  summary: string;
  image: string;
  sourceSite: string;
  published: boolean;
}
