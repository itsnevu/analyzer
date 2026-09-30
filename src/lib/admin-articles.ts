import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import type { Article } from "@/lib/data";

/** Shared by the admin article API routes. Server-only. */

export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Turns a request body into an article, or null when the title is missing. */
export function normalizeArticle(input: Record<string, unknown>): Article | null {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = s(input.title);
  if (!title) return null;
  const verdict = ["valid", "misleading", "hoax"].includes(s(input.verdict))
    ? (s(input.verdict) as Article["verdict"])
    : "misleading";
  return {
    slug: slugify(s(input.slug)) || slugify(title),
    title,
    lang: input.lang === "en" ? "en" : "id",
    category: s(input.category) || "Misinformation",
    verdict,
    date: /^\d{4}-\d{2}-\d{2}$/.test(s(input.date)) ? s(input.date) : new Date().toISOString().slice(0, 10),
    summaryId: s(input.summaryId),
    summaryEn: s(input.summaryEn),
    source: s(input.source),
    narration: s(input.narration),
    explanation: s(input.explanation),
    reference: s(input.reference),
    image: s(input.image),
    originalUrl: /^https?:\/\//i.test(s(input.originalUrl)) ? s(input.originalUrl) : undefined,
    published: input.published !== false && input.published !== "false" && input.published !== 0,
  };
}
